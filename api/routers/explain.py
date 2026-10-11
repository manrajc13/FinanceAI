from fastapi import APIRouter, Depends, Request

from agent.graph import run_agent
from agent.preferences import Preferences
from api.deps import get_payload
from api.errors import domain_errors
from api.sanitize import public
from api.schemas.common import ERROR_RESPONSES, ErrorResponse
from api.schemas.requests import ExplainRequest
from api.schemas.responses import ExplainResponse


router = APIRouter(tags=["explain"], responses={**ERROR_RESPONSES, 429: {"model": ErrorResponse}})


@router.post("/explain", response_model=ExplainResponse)
def explain(body: ExplainRequest, request: Request, payload: dict = Depends(get_payload)):
    """Grounded explanation. Offline unless use_llm=true; the model only selects fact IDs.

    Declared sync on purpose: LLM mode can block for up to two 30 s requests,
    so FastAPI runs it in the threadpool. Provider failures return 200 with
    explanation.mode == "fallback", never provider error text.
    """
    if body.use_llm:
        request.app.state.llm_limiter.check(request)
    preferences = Preferences(**body.preferences.model_dump()) if body.preferences else None
    with domain_errors():
        result = run_agent(payload, amount=body.amount, currency=body.currency, profile=body.profile,
                           hide_dust=body.hide_dust, question=body.question, use_llm=body.use_llm,
                           preferences=preferences)
    return public(result)
