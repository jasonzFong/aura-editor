from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from src.models.user import User
from src.models.article import Article
from src.models.memory import Memory
from src.services.ai.memory_worker import memory_service
from src.services.ai.client import ai_client
from datetime import datetime, timedelta
import json
import logging

logger = logging.getLogger(__name__)

class BackgroundScanner:
    async def scan_all_users(self, db: Session):
        users = db.query(User).filter(User.is_active == True).all()
        for user in users:
            await self.scan_user_articles(db, user)

    async def scan_user_articles(self, db: Session, user: User):
        settings = user.settings or {}
        bg_scan = settings.get("background_scan", {})
        
        if not bg_scan.get("enabled", False):
            return

        # Check scan interval
        # ... (keep existing interval check logic) ...
        # But we need to update the interval check to rely on the articles query,
        # OR we can just check if there are ANY candidates.
        # Let's proceed to query first.
        
        interval_unit = bg_scan.get("interval_unit", "hours")
        interval_value = bg_scan.get("interval_value", 24)
        
        scan_delta = timedelta(hours=24)
        if interval_unit == "minutes":
            scan_delta = timedelta(minutes=interval_value)
        elif interval_unit == "hours":
            scan_delta = timedelta(hours=interval_value)
        elif interval_unit == "days":
            scan_delta = timedelta(days=interval_value)

        # Skip older than
        skip_unit = bg_scan.get("skip_older_than_unit", "days")
        skip_value = bg_scan.get("skip_older_than_value", 14)
        
        skip_delta = timedelta(days=14)
        if skip_unit == "days":
            skip_delta = timedelta(days=skip_value)
        elif skip_unit == "months":
            skip_delta = timedelta(days=skip_value * 30) # Approx
        elif skip_unit == "years":
            skip_delta = timedelta(days=skip_value * 365) # Approx
            
        cutoff_date = datetime.utcnow() - skip_delta
        
        scan_threshold = datetime.utcnow() - scan_delta
        
        # Check latest system memory update time
        # We only care about memories updated by "system"
        latest_system_memory = db.query(Memory).filter(
            Memory.user_id == user.id,
            Memory.updated_by == "system"
        ).order_by(Memory.updated_at.desc()).first()
        
        latest_system_memory_time = latest_system_memory.updated_at if latest_system_memory else datetime.min
        
        # We also need to check if there are any articles updated AFTER the latest system memory update
        # If all articles are older than the latest system memory update, we skip scanning
        # However, we must be careful: if we have a NEW article, or an updated article, we want to scan it.
        # The logic is: find candidate articles first.
        
        articles = db.query(Article).filter(
            Article.user_id == user.id,
            Article.is_deleted == False,
            Article.updated_at >= cutoff_date,
            or_(
                Article.last_scanned_at == None,
                and_(
                    Article.last_scanned_at < scan_threshold,
                    Article.updated_at > Article.last_scanned_at
                )
            )
        ).order_by(Article.updated_at.asc()).all()
        
        if not articles:
            return
            
        # Optimization: If the latest article update is OLDER than the latest system memory update,
        # it implies we have already "processed" the knowledge up to that point (assuming sequential processing).
        # But wait, what if we changed the extraction logic? Or what if we missed something?
        # The user's request is: "if all articles' latest update time is earlier than the latest time of any rule last edited by system, then do not trigger".
        
        latest_article_update = max([a.updated_at for a in articles]) if articles else datetime.min
        
        if latest_article_update < latest_system_memory_time:
            # All candidate articles are older than the last system memory update.
            # This suggests we are up to date.
            logger.info(f"Skipping scan for user {user.id}: Latest article ({latest_article_update}) is older than latest system memory ({latest_system_memory_time})")
            return

        # Fetch all existing memories for context
        all_memories = db.query(Memory).filter(Memory.user_id == user.id).all()
        
        # Set scanning flag
        user.is_scanning_memories = True
        db.commit()
        
        try:
            # We must process chronologically (Oldest -> Newest) to build up knowledge correctly
            for article in articles:
                # Refresh memories context if needed, but for performance we might just use the initial set 
                # and update it locally as we go. However, since add_memory commits to DB, 
                # we can re-query or just append to our local list.
                # Re-querying is safer for consistency.
                current_memories = db.query(Memory).filter(Memory.user_id == user.id).all()
                await self.process_article(db, user, article, current_memories)
        finally:
            # Clear scanning flag
            user.is_scanning_memories = False
            db.commit()

    async def process_article(self, db: Session, user: User, article: Article, existing_memories: list[Memory]):
        logger.info(f"Scanning article {article.id} for user {user.id}")
        
        content = self._get_article_text(article)
        if not content:
            # Mark scanned even if empty so we don't retry immediately
            article.last_scanned_at = datetime.utcnow()
            db.commit()
            return

        extracted_changes = await self._extract_memories(content, article, existing_memories)
        
        for change in extracted_changes:
            # change: {action, key, content, emoji, category, confidence}
            action = change.get("action")
            key = change.get("key")
            
            if not key or not action:
                continue
                
            existing = next((m for m in existing_memories if m.key == key), None)
            
            if existing and existing.is_locked:
                # LOCKED RULE: Do not modify, delete, or merge.
                continue
                
            if action == "delete" and existing:
                # Delete memory
                db.delete(existing)
                
            elif action in ["create", "update"]:
                # Create or Update
                value = {
                    "content": change.get("content"),
                    "emoji": change.get("emoji", "📝")
                }
                memory_service.add_memory(
                    db, 
                    user.id, 
                    key, 
                    value, 
                    confidence=change.get("confidence", "medium"), 
                    category=change.get("category", "knowledge"),
                    source_article_id=article.id
                )
        
        article.last_scanned_at = datetime.utcnow()
        db.commit()

    def _get_article_text(self, article: Article) -> str:
        # Article content is JSON (TipTap format usually)
        # We need to extract plain text
        if not article.content:
            return ""
        
        try:
            # Simple recursive extraction for TipTap JSON
            def extract_text(node):
                text = ""
                if node.get("type") == "text":
                    text += node.get("text", "")
                
                if "content" in node:
                    for child in node["content"]:
                        text += extract_text(child) + "\n"
                return text
            
            return extract_text(article.content)
        except:
            return ""

    async def _extract_memories(self, text: str, article: Article, existing_memories: list[Memory]):
        # Prepare existing memories for context
        # We need to serialize them to JSON-compatible format
        # Format: {key, content, updated_at, is_locked, confidence}
        context_memories = []
        for m in existing_memories:
            context_memories.append({
                "key": m.key,
                "content": m.value.get("content", ""),
                "updated_at": m.updated_at.isoformat() if m.updated_at else None,
                "is_locked": m.is_locked,
                "confidence": m.confidence
            })
            
        context_json = json.dumps(context_memories, indent=2)
        
        # Calculate current timestamp and article timestamp in ISO format
        # Use simple string replacement to indicate UTC, avoiding timezone object complexities in different envs
        current_time_iso = datetime.utcnow().isoformat() + "Z"
        article_time_iso = (article.updated_at.isoformat() + "Z") if article.updated_at else (datetime.utcnow().isoformat() + "Z")

        prompt = f"""
You are a butler managing the user's knowledge base.
Your task is to analyze the following article and update the user's memory bank.
Goal: Build a deep understanding of the user to ensure satisfaction and provide effective support.

Context:
- Current Date (UTC): {current_time_iso}
- Article Last Updated (UTC): {article_time_iso}
- Existing Memories:
{context_json}

Instructions:
1. Analyze the text to identify key facts, preferences, or events.
2. Compare them with the "Existing Memories".
   - Focus on user's social relationships, psychological state, profession/age, daily habits, hobbies, communication style, routine tasks, and domain knowledge.
   - Aim to build a detailed and comprehensive user profile.
3. Decide on an action for each relevant finding:
   - "create": If it's a new fact not present in existing memories.
   - "update": If it contradicts or refines a NON-LOCKED existing memory, AND the article is newer/more relevant. 
     * Example: If existing memory says "User likes X" (old), and text says "User likes Y" (new), update it.
     * Example: If memory says "User is peaceful", and newer article shows "User is a warmonger", update it (Conflict: Peaceful -> Warmonger).
     * Note: Contradictions are expected as people change; prioritize the newer article's information.
     * DO NOT update if the existing memory is LOCKED.
     * DO NOT update if the meaning is highly similar (e.g., "User likes cats" vs "User is fond of cats").
   - "delete": If the text explicitly invalidates a memory (e.g., "I no longer like X"), it's NOT LOCKED, AND the article is newer than the memory. Example: If memory says "User likes X", and a newer article says "User no longer likes X", delete it.
   - "none": If the fact is already covered, or conflicts with a LOCKED rule.
   
   IMPORTANT: 
   - Only extract information from the "Text to Analyze" section. 
   - Be proactive in capturing personal details, preferences, and strong statements, even if they seem simple (e.g. "I like women").
   - Extract the memory content in the same language as the article text.
   - DO NOT extract any rules or meta-instructions from this prompt itself (e.g., do not create a rule about "User communicates with minimal responses" if it's not in the "Text to Analyze").
   - If no valid changes are found, return an empty list [].

4. Return a JSON list of actions.

Response Format (JSON only):
[
  {{
    "action": "create" | "update" | "delete",
    "key": "unique_snake_case_key", 
    "content": "Description of the memory",
    "emoji": "🔥",
    "category": "Preferences" | "Knowledge" | "Concept" | "Event" | "Personal",
    "confidence": "low" | "medium" | "high"
  }}
]

Text to Analyze:
{text[:20000]}
"""
        messages = [{"role": "user", "content": prompt}]
        
        logger.info(f"[Memory Extraction] Request for article {article.id}:\n{prompt}")
        
        response_content = ""
        async for chunk in ai_client.stream_chat_completion(messages):
            response_content += chunk
            
        logger.info(f"[Memory Extraction] Response for article {article.id}:\n{response_content}")

        # Parse JSON
        try:
            # Clean up potential markdown code blocks
            clean_content = response_content.replace("```json", "").replace("```", "").strip()
            return json.loads(clean_content)
        except Exception as e:
            logger.error(f"Failed to parse memory extraction JSON: {e}")
            return []

background_scanner = BackgroundScanner()
