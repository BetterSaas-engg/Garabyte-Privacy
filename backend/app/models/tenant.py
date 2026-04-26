"""Tenant model -- an organization using the platform."""

from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, JSON, String
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

    # Display string -- "Ontario & Quebec, Canada", "Canada (national)", etc.
    # Used by the dashboard headers; for jurisdiction-aware filtering of
    # regulatory citations, use jurisdiction_codes below.
    jurisdiction = Column(String(128), nullable=False, default="Canada")

    # Phase 6B (audit M22): list of jurisdiction codes the tenant operates
    # in. Used to filter regulatory citations to only those that apply.
    # Codes follow ISO 3166 conventions extended for federal vs sub-national:
    #     "CA"     - Canada (federal, applies to PIPEDA / CASL / AIDA)
    #     "CA-ON"  - Ontario
    #     "CA-QC"  - Quebec (Law 25)
    #     "EU"     - European Union (GDPR)
    #     "US"     - United States (federal)
    #     "US-CA"  - California (CCPA)
    # Empty list / null is treated as "show all citations" so the field
    # can be populated incrementally without breaking existing reports.
    jurisdiction_codes = Column(JSON, nullable=True)

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
