from __future__ import annotations

import json
import urllib.error
import urllib.request
import html
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional

import structlog

logger = structlog.get_logger()

_API_CONFIG_PATH = Path.home() / ".deepsleep" / "api_config.json"


class OllamaUnavailableError(RuntimeError):
    """Raised when Ollama is unavailable."""


@dataclass
class LLMReply:
    text: str
    model: str
    used_fallback: bool = False


class CloudAPIClient:
    """Base class for cloud API fallback clients."""

    def answer_question(self, question: str, memory_context: str, file_context: str) -> LLMReply:
        raise NotImplementedError

    def summarize_activity(
        self,
        changed_files: List[str],
        file_snippets: Dict[str, str],
        previous_summary: str,
    ) -> LLMReply:
        raise NotImplementedError


class ClaudeAPIClient(CloudAPIClient):
    """Anthropic Claude API client via raw HTTP — no SDK required."""

    def __init__(self, api_key: str, model: str = "claude-haiku-4-5-20251001") -> None:
        self.api_key = api_key
        self.model = model
        self._host = "https://api.anthropic.com"
        self._timeout = 60

    def _request(self, messages: list, system: str = "") -> str:
        payload: dict = {
            "model": self.model,
            "max_tokens": 1024,
            "messages": messages,
        }
        if system:
            payload["system"] = system

        data = json.dumps(payload).encode("utf-8")
        headers = {
            "Content-Type": "application/json",
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
        }
        req = urllib.request.Request(
            f"{self._host}/v1/messages",
            data=data,
            method="POST",
            headers=headers,
        )
        try:
            with urllib.request.urlopen(req, timeout=self._timeout) as resp:
                raw = resp.read().decode("utf-8")
        except (urllib.error.URLError, ConnectionError, TimeoutError) as exc:
            raise OllamaUnavailableError(f"Claude API unavailable: {exc}") from exc

        result = json.loads(raw)
        if "error" in result:
            raise OllamaUnavailableError(f"Claude API error: {result['error'].get('message', result['error'])}")
        return result["content"][0]["text"].strip()

    def answer_question(self, question: str, memory_context: str, file_context: str) -> LLMReply:
        system = (
            "You are DeepSleep, a local coding copilot. Answer concisely, stay practical, "
            "use the provided project memory, and suggest file-specific next steps when relevant."
        )
        user_msg = (
            f"Project memory:\n{memory_context}\n\n"
            f"Relevant file context:\n{file_context or 'No extra file context.'}\n\n"
            f"User question: {question}\n\nAnswer in a terminal-friendly style."
        )
        text = self._request([{"role": "user", "content": user_msg}], system=system)
        return LLMReply(text=text, model=f"claude/{self.model}", used_fallback=True)

    def summarize_activity(
        self,
        changed_files: List[str],
        file_snippets: Dict[str, str],
        previous_summary: str,
    ) -> LLMReply:
        system = (
            "You are DeepSleep's dream loop. Write a compact session summary using only factual "
            "details from the changed files. Mention the most likely task and the next sensible step."
        )
        snippet_block = "\n\n".join(
            f"[{path}]\n{snippet}" for path, snippet in file_snippets.items()
        )
        user_msg = (
            f"Previous session summary:\n{previous_summary}\n\n"
            f"Changed files:\n- " + "\n- ".join(changed_files) + "\n\n"
            f"Snippets:\n{snippet_block or 'No readable snippets.'}\n\n"
            "Return a concise paragraph under 120 words."
        )
        text = self._request([{"role": "user", "content": user_msg}], system=system)
        return LLMReply(text=text, model=f"claude/{self.model}", used_fallback=True)


class OpenAIClient(CloudAPIClient):
    """OpenAI Chat Completions client via raw HTTP — no SDK required."""

    def __init__(self, api_key: str, model: str = "gpt-4o-mini") -> None:
        self.api_key = api_key
        self.model = model
        self._host = "https://api.openai.com"
        self._timeout = 60

    def _request(self, messages: list) -> str:
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": 0.2,
            "max_tokens": 1024,
        }
        data = json.dumps(payload).encode("utf-8")
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
        }
        req = urllib.request.Request(
            f"{self._host}/v1/chat/completions",
            data=data,
            method="POST",
            headers=headers,
        )
        try:
            with urllib.request.urlopen(req, timeout=self._timeout) as resp:
                raw = resp.read().decode("utf-8")
        except (urllib.error.URLError, ConnectionError, TimeoutError) as exc:
            raise OllamaUnavailableError(f"OpenAI API unavailable: {exc}") from exc

        result = json.loads(raw)
        if "error" in result:
            raise OllamaUnavailableError(f"OpenAI API error: {result['error'].get('message', result['error'])}")
        return result["choices"][0]["message"]["content"].strip()

    def answer_question(self, question: str, memory_context: str, file_context: str) -> LLMReply:
        system = (
            "You are DeepSleep, a local coding copilot. Answer concisely, stay practical, "
            "use the provided project memory, and suggest file-specific next steps when relevant."
        )
        user_msg = (
            f"Project memory:\n{memory_context}\n\n"
            f"Relevant file context:\n{file_context or 'No extra file context.'}\n\n"
            f"User question: {question}\n\nAnswer in a terminal-friendly style."
        )
        text = self._request([
            {"role": "system", "content": system},
            {"role": "user", "content": user_msg},
        ])
        return LLMReply(text=text, model=f"openai/{self.model}", used_fallback=True)

    def summarize_activity(
        self,
        changed_files: List[str],
        file_snippets: Dict[str, str],
        previous_summary: str,
    ) -> LLMReply:
        system = (
            "You are DeepSleep's dream loop. Write a compact session summary using only factual "
            "details from the changed files. Mention the most likely task and the next sensible step."
        )
        snippet_block = "\n\n".join(
            f"[{path}]\n{snippet}" for path, snippet in file_snippets.items()
        )
        user_msg = (
            f"Previous session summary:\n{previous_summary}\n\n"
            f"Changed files:\n- " + "\n- ".join(changed_files) + "\n\n"
            f"Snippets:\n{snippet_block or 'No readable snippets.'}\n\n"
            "Return a concise paragraph under 120 words."
        )
        text = self._request([
            {"role": "system", "content": system},
            {"role": "user", "content": user_msg},
        ])
        return LLMReply(text=text, model=f"openai/{self.model}", used_fallback=True)


def load_cloud_client() -> Optional[CloudAPIClient]:
    """Return the configured cloud API client, or None if not set up."""
    if not _API_CONFIG_PATH.exists():
        return None
    try:
        data = json.loads(_API_CONFIG_PATH.read_text(encoding="utf-8"))
        provider = data.get("provider", "").lower()
        api_key = data.get("api_key", "").strip()
        if not provider or not api_key:
            return None
        if provider == "claude":
            return ClaudeAPIClient(api_key=api_key)
        if provider == "openai":
            return OpenAIClient(api_key=api_key)
    except Exception:
        pass
    return None


def save_cloud_config(provider: str, api_key: str) -> None:
    """Persist cloud API config to ~/.deepsleep/api_config.json."""
    _API_CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    _API_CONFIG_PATH.write_text(
        json.dumps({"provider": provider, "api_key": api_key}),
        encoding="utf-8",
    )


def remove_cloud_config() -> bool:
    """Delete the stored cloud API config. Returns True if it existed."""
    if _API_CONFIG_PATH.exists():
        _API_CONFIG_PATH.unlink()
        return True
    return False


class OllamaClient:
    """Small Ollama client with a deterministic local fallback and prompt sanitization."""

    def __init__(
        self,
        model: str = "deepseek-r1",
        host: str = "http://127.0.0.1:11434",
        timeout: int = 120,
    ) -> None:
        self.model = model
        self.host = host.rstrip("/")
        self.timeout = timeout

    def is_available(self) -> bool:
        try:
            self._request("GET", "/api/tags")
            return True
        except OllamaUnavailableError:
            return False

    def list_models(self) -> List[str]:
        data = self._request("GET", "/api/tags")
        models = []
        for item in data.get("models", []):
            name = item.get("name")
            if isinstance(name, str) and name:
                models.append(name)
        return models

    def model_available(self, model_name: Optional[str] = None) -> bool:
        target = model_name or self.model
        try:
            return target in self.list_models()
        except OllamaUnavailableError:
            return False

    def generate(self, system_prompt: str, prompt: str) -> LLMReply:
        payload = {
            "model": self.model,
            "system": system_prompt,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": 0.2,
            },
        }
        logger.debug("ollama_generate_request", model=self.model)
        data = self._request("POST", "/api/generate", payload)
        response_text = str(data.get("response", "")).strip()
        if not response_text:
            logger.error("ollama_empty_response", model=self.model)
            raise OllamaUnavailableError("Ollama returned an empty response.")

        logger.info("ollama_generate_success", model=self.model)
        return LLMReply(text=response_text, model=self.model, used_fallback=False)

    def answer_question(
        self,
        question: str,
        memory_context: str,
        file_context: str,
        fallback_client: Optional[CloudAPIClient] = None,
    ) -> LLMReply:
        system_prompt = (
            "You are DeepSleep, a local coding copilot. Answer concisely, stay practical, "
            "use the provided project memory, and suggest file-specific next steps when relevant."
        )
        prompt = (
            f"Project memory:\n{memory_context}\n\n"
            f"Relevant file context:\n{file_context or 'No extra file context.'}\n\n"
            f"User question: {self._sanitize_for_prompt(question)}\n\n"
            "Answer in a terminal-friendly style. If the user asks what they were doing, "
            "summarize the active session and recent files."
        )

        try:
            return self.generate(system_prompt, prompt)
        except OllamaUnavailableError as exc:
            logger.warning("ollama_fallback_triggered", error=str(exc))
            if fallback_client is not None:
                try:
                    logger.info("cloud_fallback_triggered", model=getattr(fallback_client, "model", "cloud"))
                    return fallback_client.answer_question(question, memory_context, file_context)
                except OllamaUnavailableError as cloud_exc:
                    logger.warning("cloud_fallback_failed", error=str(cloud_exc))
            return self._fallback_answer(question, memory_context, file_context)

    def summarize_activity(
        self,
        changed_files: List[str],
        file_snippets: Dict[str, str],
        previous_summary: str,
        fallback_client: Optional[CloudAPIClient] = None,
    ) -> LLMReply:
        system_prompt = (
            "You are DeepSleep's dream loop. Write a compact session summary using only factual "
            "details from the changed files. Mention the most likely task and the next sensible step."
        )

        snippet_block = "\n\n".join(
            f"[{path}]\n{self._sanitize_for_prompt(snippet)}"
            for path, snippet in file_snippets.items()
        )

        prompt = (
            f"Previous session summary:\n{previous_summary}\n\n"
            f"Changed files:\n- " + "\n- ".join(changed_files) + "\n\n"
            f"Snippets:\n{snippet_block or 'No readable snippets.'}\n\n"
            "Return a concise paragraph under 120 words."
        )

        try:
            return self.generate(system_prompt, prompt)
        except OllamaUnavailableError as exc:
            logger.warning("ollama_fallback_triggered", error=str(exc))
            if fallback_client is not None:
                try:
                    return fallback_client.summarize_activity(changed_files, file_snippets, previous_summary)
                except OllamaUnavailableError as cloud_exc:
                    logger.warning("cloud_fallback_failed", error=str(cloud_exc))
            return self._fallback_summary(changed_files, file_snippets, previous_summary)

    def _sanitize_for_prompt(self, text: str) -> str:
        """Prevent prompt injection via file content or user input."""
        text = ''.join(char for char in text if ord(char) >= 32 or char in '\n\r\t')
        return html.escape(text)

    def _fallback_answer(
        self,
        question: str,
        memory_context: str,
        file_context: str,
    ) -> LLMReply:
        lower = question.lower()
        if "what was i doing" in lower or "what was i working on" in lower:
            lines = [
                "Ollama is offline, so here is the local memory snapshot:",
                memory_context.strip(),
            ]
        else:
            lines = [
                "Ollama is offline, so I am answering from the saved local context.",
                "Question:",
                question.strip(),
                "",
                "Memory:",
                memory_context.strip(),
            ]
            if file_context:
                lines.extend(["", "Relevant files:", file_context.strip()])
        return LLMReply(text="\n".join(lines).strip(), model="heuristic-fallback", used_fallback=True)

    def _fallback_summary(
        self,
        changed_files: List[str],
        file_snippets: Dict[str, str],
        previous_summary: str,
    ) -> LLMReply:
        snippet_preview = []
        for path, snippet in list(file_snippets.items())[:3]:
            first_line = next((line.strip() for line in snippet.splitlines() if line.strip()), "")
            if first_line:
                snippet_preview.append(f"{path}: {first_line[:80]}")

        description = (
            "Idle dream summary: "
            + (f"continued from '{previous_summary}'. " if previous_summary and previous_summary != "No session summary yet." else "")
            + f"Recent activity touched {len(changed_files)} file(s): {', '.join(changed_files[:6]) or 'none'}."
        )
        if snippet_preview:
            description += " Key clues: " + " | ".join(snippet_preview)
        description += " Next step: reopen the newest file and continue from the last edited section."
        return LLMReply(text=description, model="heuristic-fallback", used_fallback=True)

    def _request(
        self,
        method: str,
        endpoint: str,
        payload: Optional[dict] = None,
    ) -> dict:
        url = f"{self.host}{endpoint}"
        data = None
        headers = {}
        if payload is not None:
            data = json.dumps(payload).encode("utf-8")
            headers["Content-Type"] = "application/json"

        request = urllib.request.Request(url, data=data, method=method, headers=headers)

        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                raw = response.read().decode("utf-8")
        except (urllib.error.URLError, ConnectionError, TimeoutError) as exc:
            raise OllamaUnavailableError(str(exc)) from exc

        try:
            return json.loads(raw) if raw else {}
        except json.JSONDecodeError as exc:
            raise OllamaUnavailableError("Ollama returned invalid JSON.") from exc
