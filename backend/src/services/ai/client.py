import httpx
from src.core.config import settings
import json
import asyncio

class AIClient:
    def __init__(self):
        self.provider = settings.AI_PROVIDER.lower()
        self.api_key = self._get_api_key()
        self.base_url = self._get_base_url()
        self.model = self._get_model()

    def _get_api_key(self):
        if self.provider == "deepseek":
            return settings.DEEPSEEK_API_KEY
        elif self.provider == "openai":
            return settings.OPENAI_API_KEY
        return ""

    def _get_base_url(self):
        if self.provider == "deepseek":
            return "https://api.deepseek.com/v1"
        elif self.provider == "openai":
            return "https://api.openai.com/v1"
        return ""

    def _get_model(self):
        if settings.AI_MODEL:
            return settings.AI_MODEL
        if self.provider == "deepseek":
            return "deepseek-chat"
        elif self.provider == "openai":
            return "gpt-3.5-turbo"
        return ""

    async def stream_chat_completion(self, messages: list):
        if not self.api_key or self.api_key in ["", "your_key_here", "your-deepseek-api-key-here", "your-openai-api-key-here"]:
            mock_responses = ["Thinking...", "Analyzing...", "Suggestion: This paragraph flows well!"]
            for resp in mock_responses:
                await asyncio.sleep(0.5)
                yield resp
            return

        async with httpx.AsyncClient() as client:
            async with client.stream(
                "POST", 
                f"{self.base_url}/chat/completions",
                headers={"Authorization": f"Bearer {self.api_key}"},
                json={"model": self.model, "messages": messages, "stream": True}
            ) as response:
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        data = line[6:]
                        if data == "[DONE]":
                            break
                        try:
                            json_data = json.loads(data)
                            content = json_data["choices"][0]["delta"].get("content", "")
                            if content:
                                yield content
                        except:
                            pass

ai_client = AIClient()
