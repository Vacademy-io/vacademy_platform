"""Incident-structure prompt — ported verbatim from media_service
LlController#generateIncidentStructure (the template is inline in the Java
controller). Placeholders {incidentText},{incidentTypes}; literal JSON braces
doubled for str.format.
"""
from __future__ import annotations

from .incident_types import incident_types_json

_TEMPLATE = """Generate incident details for the following raw incident data:
{incidentText}


Incident Category, Code Mapping : {incidentTypes}
We need to extract a title, description, and categorize a incident code, category and subcategory

also if the raw incident data if not in english then translate it to english
return the data in a json structure
{{
    "event_code": "INCIDENT_CODE", // from Incident Category, Code Mapping like ET1002
    "category": "INCIDENT_CATEGORY", // for the same event code
    "subcategory": "INCIDENT_SUBCATEGORY", // from Incident Category, Code Mapping
    "description": "INCIDENT_DESCRIPTION", // make a detailed report for the incident
    "title": "INCIDENT_TITLE", // title of the incident
    "was_reported_to_police": true/false, // check if the incident was reported to police
    "people_injured": [ // list of people injured if any
        {{
            "name": "NAME",
            "nature": "NATURE_OF_INJURY",
            "is_employee": true/false // check if the person is an employee
        }}
    ],
    "property_loss": [ // list of property damages or stolen items if any
        {{
            "name": "PROPERTY_NAME", // Name of the property damaged or stolen
            "description": "DESCRIPTION", // Description of the damage or theft
            "loss_value": 0.0, // Estimated loss value
            "type": "DAMAGE/STOLEN" // type of loss: either "DAMAGE" or "STOLEN"
        }}
    ],
    "suspects": [ // list of suspects if any
        {{
            "name": "NAME", // Name of the suspect keep empty if not known
            "description": "DESCRIPTION" // Description of the suspect
        }}
    ]
}}
"""


def build_prompt(incident_text: str) -> str:
    return _TEMPLATE.format(incidentText=incident_text or "", incidentTypes=incident_types_json())
