from fastapi import APIRouter, Depends
from fastapi.responses import Response

from api.deps import get_payload, get_state
from api.schemas.common import ERROR_RESPONSES
from api.schemas.requests import AllocateRequest
from api.schemas.responses import AllocationResponse
from api.services import allocation_csv, allocation_payload, csv_filename
from api.state import AnalysisState


router = APIRouter(prefix="/allocate", tags=["allocation"], responses=ERROR_RESPONSES)


@router.post("", response_model=AllocationResponse)
def allocate(body: AllocateRequest, payload: dict = Depends(get_payload),
             state: AnalysisState = Depends(get_state)):
    """Exact fractional targets plus a reconciled display view; no trades or share counts."""
    return allocation_payload(payload, state, body.amount, body.currency, body.profile, body.hide_dust)


@router.post("/export.csv", response_class=Response,
             responses={200: {"content": {"text/csv": {}}, "description": "Allocation CSV"}})
def export_csv(body: AllocateRequest, payload: dict = Depends(get_payload),
               state: AnalysisState = Depends(get_state)):
    """CSV of every holding (hide_dust is ignored so no ticker is omitted)."""
    allocation = allocation_payload(payload, state, body.amount, body.currency, body.profile, False)
    return Response(allocation_csv(allocation), media_type="text/csv; charset=utf-8",
                    headers={"Content-Disposition":
                             f'attachment; filename="{csv_filename(body.profile, body.currency)}"'})
