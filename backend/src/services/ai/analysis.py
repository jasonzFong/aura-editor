from .client import ai_client
from sqlalchemy.orm import Session
from src.models.user import User
from src.services.ai.memory_worker import memory_service

class AIAnalysisService:
    async def analyze_text(self, text: str, context: str = "", user: User = None, db: Session = None, existing_quotes: list[str] = None):
        system_prompt = (
            "You are a helpful writing assistant. Provide comments on the text. "
            "Please detect the language of the user's text and respond in the same language. "
            "If the text is in Chinese, respond in Chinese. If the text is in English, respond in English."
            "\n\nIMPORTANT: Please provide ONLY ONE comment for the most significant part of the text that needs improvement.\n"
            "Or if you find a specific part particularly interesting or well-written, give a simple encouragement.\n"
            "The core goal is to make the user feel you are USEFUL and INTERESTING.\n"
            "EMOTIONAL SUPPORT GUIDELINES:\n"
            "- If the user expresses SADNESS: Tell a gentle joke to lighten the mood.\n"
            "- If the user expresses LONELINESS: Offer warm companionship.\n"
            "- Make the user feel APPRECIATED and cared for.\n"
            "- DO NOT PREACH or lecture the user.\n"
            "Quality over quantity. If there is nothing worth commenting on (neither improvement nor encouragement), do NOT output any comment.\n"
            "If the user's text is meaningless (e.g., random characters like 'xsdef', simple punctuation '?!', or too short/vague), output >> NO_COMMENT.\n"
            "\nOutput in this exact format:\n"
            ">> QUOTE: <exact substring from text>\n"
            ">> COMMENT: <your comment>\n"
            "If you have a general comment (only if no specific part needs comment), use:\n"
            ">> QUOTE: NONE\n"
            ">> COMMENT: <your comment>\n"
            "If NO comment is needed, output exactly:\n"
            ">> NO_COMMENT\n"
            "Do not use markdown formatting for these headers. Do not output multiple comments."
        )

        if existing_quotes and len(existing_quotes) > 0:
            quotes_str = "\n".join([f"- {q}" for q in existing_quotes])
            system_prompt += f"\n\nIMPORTANT: The following parts of the text have ALREADY been commented on. DO NOT comment on them again:\n{quotes_str}"
        
        # Inject Memory if user exists
        if user and db:
            memories = memory_service.get_memories(db, user.id)
            if memories:
                # Pass ALL memories to the AI
                sorted_memories = sorted(
                    memories, 
                    key=lambda m: (m.confidence or 0, m.updated_at or m.created_at), 
                    reverse=True
                )
                
                memory_context = "\n".join([f"- {m.key}: {m.value} (Confidence: {m.confidence}, Updated: {m.updated_at or m.created_at})" for m in sorted_memories])
                system_prompt += f"\n\nHere is EVERYTHING we know about the user's preferences. You can refer to these preferences in your comments to the user, BUT do so naturally (e.g., 'Since you like concise writing...'), avoiding phrases like 'According to my memory' or 'I know that you...'.:\n{memory_context}"

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Context: {context}\n\nText: {text}"}
        ]

        async for chunk in ai_client.stream_chat_completion(messages):
            yield chunk

    async def reply_to_comment(self, conversation_history: list[dict], context_data: dict, user: User = None, db: Session = None):
        """
        Generate a reply to a user's comment in a thread.
        conversation_history: list of {role: 'user'|'ai', content: str}
        context_data: {quote: str, original_suggestion: str}
        """
        system_prompt = (
            "You are a helpful and interesting assistant. You previously provided a comment (suggestion, encouragement, or joke) for a specific text.\n"
            "Now you are discussing this comment with the user.\n"
            "Goal: Engage with the user based on your previous comment. If it was a suggestion, help them improve. If it was a joke or encouragement, continue the warm conversation.\n"
            "If the user wants to talk about other topics, feel free to follow them and have a natural conversation about whatever they're interested in.\n"
            "Do NOT repeatedly mention your original comment once the conversation has shifted to other topics.\n"
            "Style: Concise, professional, and encouraging.\n"
            "Please detect the language of the user's latest reply and respond in the same language."
        )

        # Inject Memory if user exists
        if user and db:
            memories = memory_service.get_memories(db, user.id)
            if memories:
                memory_context = "\n".join([f"- {m.key}: {m.value}" for m in memories])
                system_prompt += (
                    f"\n\nKeep in mind the user's preferences:\n{memory_context}\n"
                    "You can refer to these preferences in your comments to the user, BUT do so naturally (e.g., 'Since you like concise writing...'), "
                    "avoiding phrases like 'According to my memory' or 'I know that you...'."
                )

        messages = [{"role": "system", "content": system_prompt}]
        
        # Add context about the original suggestion
        context_msg = (
            f"Original Text (Quote): \"{context_data.get('quote', '')}\"\n"
            f"Your Original Suggestion: \"{context_data.get('original_suggestion', '')}\"\n"
        )
        messages.append({"role": "user", "content": f"Context:\n{context_msg}\n\n(Conversation follows below...)"})
        messages.append({"role": "assistant", "content": "Understood. I'm ready to discuss this suggestion."})

        # Append history
        for msg in conversation_history:
            role = "user" if msg["role"] == "user" else "assistant"
            messages.append({"role": role, "content": msg["content"]})

        async for chunk in ai_client.stream_chat_completion(messages):
            yield chunk

analysis_service = AIAnalysisService()
