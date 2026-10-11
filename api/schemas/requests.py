from typing import Self

from pydantic import Field, field_validator, model_validator

from api.schemas.common import Currency, Emphasis, Money, ProfileName, StrictModel


class AllocateRequest(StrictModel):
    amount: Money
    currency: Currency = "USD"
    profile: ProfileName = "medium"
    hide_dust: bool = False


class PreferencesRequest(StrictModel):
    """Annual decimals: 0.25 means 25%. None means no limit."""

    emphasis: Emphasis = "balanced"
    max_volatility: float | None = Field(default=None, gt=0, le=5)
    min_expected_return: float | None = Field(default=None, ge=-1, le=5)


class ExplainRequest(StrictModel):
    question: str | None = Field(default=None, min_length=1, max_length=2000)
    use_llm: bool = False
    amount: Money | None = None
    currency: Currency = "USD"
    profile: ProfileName = "medium"
    hide_dust: bool = False
    preferences: PreferencesRequest | None = None

    @model_validator(mode="after")
    def question_requires_llm(self) -> Self:
        if self.question is not None and not self.use_llm:
            raise ValueError("A question requires use_llm=true; offline mode provides a general comparison.")
        return self


class PlanCreate(StrictModel):
    name: str = Field(min_length=1, max_length=80)
    note: str | None = Field(default=None, max_length=500)
    amount: Money
    currency: Currency = "USD"
    profile: ProfileName = "medium"
    hide_dust: bool = False

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Name must not be blank.")
        return value.strip()
