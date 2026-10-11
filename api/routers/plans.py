import json
from datetime import timezone

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy import func
from sqlmodel import Session, select

from api.db import Plan
from api.deps import get_payload, get_session, get_state
from api.errors import NotFound
from api.schemas.common import ERROR_RESPONSES, ErrorResponse
from api.schemas.requests import PlanCreate
from api.schemas.responses import PlanDetail, PlanList, PlanSummary
from api.services import allocation_csv, allocation_payload, csv_filename
from api.state import AnalysisState


router = APIRouter(prefix="/plans", tags=["plans"],
                   responses={**ERROR_RESPONSES, 404: {"model": ErrorResponse}})


def _summary(plan: Plan, state: AnalysisState) -> dict:
    metadata = state.payload["metadata"]
    created = plan.created_at if plan.created_at.tzinfo else plan.created_at.replace(tzinfo=timezone.utc)
    return {"id": plan.id, "name": plan.name, "note": plan.note, "created_at": created,
            "amount": plan.amount, "currency": plan.currency, "profile": plan.profile,
            "hide_dust": plan.hide_dust, "dataset_start": plan.dataset_start, "dataset_end": plan.dataset_end,
            "dataset_matches_current": (plan.dataset_start, plan.dataset_end)
            == (metadata["start_date"], metadata["end_date"])}


def _get(session: Session, plan_id: str) -> Plan:
    plan = session.get(Plan, plan_id)
    if plan is None:
        raise NotFound("Plan not found.")
    return plan


@router.get("", response_model=PlanList)
def list_plans(limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0),
               session: Session = Depends(get_session), state: AnalysisState = Depends(get_state)):
    total = session.exec(select(func.count()).select_from(Plan)).one()
    plans = session.exec(select(Plan).order_by(Plan.created_at.desc(), Plan.id).offset(offset).limit(limit)).all()
    return {"items": [_summary(plan, state) for plan in plans], "total": total, "limit": limit, "offset": offset}


@router.post("", response_model=PlanDetail, status_code=201)
def create_plan(body: PlanCreate, session: Session = Depends(get_session),
                payload: dict = Depends(get_payload), state: AnalysisState = Depends(get_state)):
    """The server recomputes the allocation; clients never send amounts per ticker."""
    allocation = allocation_payload(payload, state, body.amount, body.currency, body.profile, body.hide_dust)
    metadata = state.payload["metadata"]
    plan = Plan(name=body.name, note=body.note, amount=allocation["amount"], currency=body.currency,
                profile=body.profile, hide_dust=body.hide_dust, dataset_start=metadata["start_date"],
                dataset_end=metadata["end_date"], allocation_json=json.dumps(allocation, allow_nan=False))
    session.add(plan)
    session.commit()
    session.refresh(plan)
    return {**_summary(plan, state), "allocation": allocation}


@router.get("/{plan_id}", response_model=PlanDetail)
def get_plan(plan_id: str, session: Session = Depends(get_session), state: AnalysisState = Depends(get_state)):
    plan = _get(session, plan_id)
    return {**_summary(plan, state), "allocation": json.loads(plan.allocation_json)}


@router.delete("/{plan_id}", status_code=204)
def delete_plan(plan_id: str, session: Session = Depends(get_session)):
    session.delete(_get(session, plan_id))
    session.commit()
    return Response(status_code=204)


@router.get("/{plan_id}/export.csv", response_class=Response,
            responses={200: {"content": {"text/csv": {}}, "description": "Saved plan CSV"}})
def export_plan(plan_id: str, session: Session = Depends(get_session),
                payload: dict = Depends(get_payload), state: AnalysisState = Depends(get_state)):
    """Exports the stored snapshot; a hide_dust plan is re-derived with every ticker shown."""
    plan = _get(session, plan_id)
    allocation = json.loads(plan.allocation_json)
    if plan.hide_dust:
        allocation = allocation_payload(payload, state, plan.amount, plan.currency, plan.profile, False)
    return Response(allocation_csv(allocation), media_type="text/csv; charset=utf-8",
                    headers={"Content-Disposition":
                             f'attachment; filename="{csv_filename(plan.profile, plan.currency, "financeai-plan")}"'})
