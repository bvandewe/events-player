import json
import typing
from datetime import datetime

from pydantic import BaseModel, ConfigDict, HttpUrl, field_validator


class CloudEvent(BaseModel):
    """CloudEvents v1.0 specification model"""

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "specversion": "1.0",
                "id": "A234-1234-1234",
                "time": "2025-10-16T00:00:00Z",
                "type": "com.example.sampletype",
                "source": "https://example.com/source",
                "subject": "subject123",
                "datacontenttype": "application/json",
                "data": {"key": "value"},
            }
        }
    )

    specversion: str = "1.0"
    id: str
    time: datetime
    datacontenttype: str = "application/json"
    type: str
    source: str
    subject: str
    data: typing.Dict[str, typing.Any]


class EventGeneratorRequest(BaseModel):
    """Request model for generating CloudEvents"""

    model_config = ConfigDict(extra="forbid")

    event_gateway: HttpUrl
    event_source: str
    event_type: str
    event_subject: str
    event_data: str
    iterations: int = 1
    delay: int = 100
    randomize_source: bool = False
    randomize_type: bool = False
    randomize_subject: bool = False

    @field_validator("event_data")
    @classmethod
    def validate_event_data_json(cls, value: str) -> str:
        """Validate that event_data contains valid JSON."""
        if not value or not value.strip():
            raise ValueError("event_data cannot be empty")

        try:
            json.loads(value)
        except json.JSONDecodeError as exc:
            raise ValueError(f"event_data must be valid JSON: {exc}") from exc

        return value

    @field_validator("iterations")
    @classmethod
    def check_positive_iterations(cls, value: int) -> int:
        if value < 0:
            raise ValueError("Iterations value must be a positive integer")
        return value

    @field_validator("delay")
    @classmethod
    def check_positive_delay(cls, value: int) -> int:
        if value < 0:
            raise ValueError("Delay value must be a positive integer")
        return value


class EventGeneratorTask(BaseModel):
    """Task model for tracking background event generation"""

    model_config = ConfigDict(extra="allow")

    id: str
    status: str
    progress: int = 0
    client_id: typing.Optional[str] = None
    cancelled: bool = False  # Flag to signal task cancellation
    error: typing.Optional[str] = None  # Error message if task failed

    def __setitem__(self, key: str, value: typing.Any) -> None:
        setattr(self, key, value)
