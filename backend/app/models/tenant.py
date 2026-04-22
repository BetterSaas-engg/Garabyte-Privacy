"""Tenant model -- an organization using the platform."""

from datetime import datetime

from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.orm import relationship

from .base import Base


class Tenant(Base):
    """
    An organization running privacy health checks.

    Examples: Northwind Utilities, Meridian Health Network, Cascade Telecom.
    Demo tenants have is_demo=1 and get seeded automatically.
    """
    __tablename__ = "tenants"

    id = Column(Integer, primary_key=True, index=True)
    slug = Column(String(64), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    sector = Column(String(64), nullable=False)  # utility | healthcare | telecom | other
    jurisdiction = Column(String(128), nullable=False, default="Canada")
    employee_count = Column(Integer, nullable=True)
    is_demo = Column(Integer, default=0)  # 1 if synthetic demo tenant
    created_at = Column(DateTime, default=datetime.utcnow)

    assessments = relationship(
        "Assessment",
        back_populates="tenant",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Tenant slug={self.slug} name={self.name!r}>"
