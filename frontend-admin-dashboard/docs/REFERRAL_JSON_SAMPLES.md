# Referral System JSON Sample Documentation

This document provides comprehensive JSON samples for all referrer and referee discount types in the referral system.

## Overview

The referral system uses a **tier-based JSON format** for both referrer and referee rewards. Each reward type is stored as a benefit within tiers, allowing for flexible configuration and future expansion.

## Basic Structure

### Referee Discount JSON Structure

```json
{
    "tiers": [
        {
            "tierName": "benefit",
            "referralRange": {
                "min": 1,
                "max": 1
            },
            "vestingDays": 7,
            "benefits": [
                {
                    "description": "Reward description",
                    "type": "REWARD_TYPE",
                    "value": {
                        /* type-specific value object */
                    },
                    "pointTriggers": []
                }
            ]
        }
    ]
}
```

### Referrer Discount JSON Structure

```json
{
    "tiers": [
        {
            "tierName": "Tier 1",
            "referralRange": {
                "min": 1,
                "max": 1
            },
            "vestingDays": 7,
            "benefits": [
                {
                    "description": "Reward description",
                    "type": "REWARD_TYPE",
                    "value": {
                        /* type-specific value object */
                    },
                    "pointTriggers": []
                }
            ]
        },
        {
            "tierName": "Tier 2",
            "referralRange": {
                "min": 5,
                "max": 5
            },
            "vestingDays": 7,
            "benefits": [
                {
                    "description": "Higher tier reward",
                    "type": "REWARD_TYPE",
                    "value": {
                        /* type-specific value object */
                    },
                    "pointTriggers": []
                }
            ]
        }
    ]
}
```

## Reward Types

### 1. Percentage Discount (`PERCENTAGE_DISCOUNT`)

#### Referee Example

```json
{
    "tiers": [
        {
            "tierName": "benefit",
            "referralRange": {
                "min": 1,
                "max": 1
            },
            "vestingDays": 7,
            "benefits": [
                {
                    "description": "20% discount reward",
                    "type": "PERCENTAGE_DISCOUNT",
                    "value": {
                        "percentage": 20,
                        "maxDiscount": 20.0
                    },
                    "pointTriggers": []
                }
            ]
        }
    ]
}
```

#### Referrer Example

```json
{
    "tiers": [
        {
            "tierName": "First Referral",
            "referralRange": {
                "min": 1,
                "max": 1
            },
            "vestingDays": 7,
            "benefits": [
                {
                    "description": "10% discount reward",
                    "type": "PERCENTAGE_DISCOUNT",
                    "value": {
                        "percentage": 10,
                        "maxDiscount": 10.0
                    },
                    "pointTriggers": []
                }
            ]
        },
        {
            "tierName": "Fifth Referral",
            "referralRange": {
                "min": 5,
                "max": 5
            },
            "vestingDays": 7,
            "benefits": [
                {
                    "description": "25% discount reward",
                    "type": "PERCENTAGE_DISCOUNT",
                    "value": {
                        "percentage": 25,
                        "maxDiscount": 25.0
                    },
                    "pointTriggers": []
                }
            ]
        }
    ]
}
```

### 2. Fixed Amount Discount (`FLAT_DISCOUNT`)

#### Referee Example

```json
{
    "tiers": [
        {
            "tierName": "benefit",
            "referralRange": {
                "min": 1,
                "max": 1
            },
            "vestingDays": 7,
            "benefits": [
                {
                    "description": "₹500 flat discount",
                    "type": "FLAT_DISCOUNT",
                    "value": {
                        "amount": 500
                    },
                    "pointTriggers": []
                }
            ]
        }
    ]
}
```

#### Referrer Example

```json
{
    "tiers": [
        {
            "tierName": "Bronze Tier",
            "referralRange": {
                "min": 1,
                "max": 1
            },
            "vestingDays": 7,
            "benefits": [
                {
                    "description": "₹200 flat discount",
                    "type": "FLAT_DISCOUNT",
                    "value": {
                        "amount": 200
                    },
                    "pointTriggers": []
                }
            ]
        },
        {
            "tierName": "Gold Tier",
            "referralRange": {
                "min": 10,
                "max": 10
            },
            "vestingDays": 7,
            "benefits": [
                {
                    "description": "₹1000 flat discount",
                    "type": "FLAT_DISCOUNT",
                    "value": {
                        "amount": 1000
                    },
                    "pointTriggers": []
                }
            ]
        }
    ]
}
```

### 3. Free Membership Days (`FREE_MEMBERSHIP_DAYS`)

#### Referee Example

```json
{
    "tiers": [
        {
            "tierName": "benefit",
            "referralRange": {
                "min": 1,
                "max": 1
            },
            "vestingDays": 7,
            "benefits": [
                {
                    "description": "30 days free membership",
                    "type": "FREE_MEMBERSHIP_DAYS",
                    "value": {
                        "days": 30
                    },
                    "pointTriggers": []
                }
            ]
        }
    ]
}
```

#### Referrer Example

```json
{
    "tiers": [
        {
            "tierName": "Starter Bonus",
            "referralRange": {
                "min": 1,
                "max": 1
            },
            "vestingDays": 7,
            "benefits": [
                {
                    "description": "7 days free membership",
                    "type": "FREE_MEMBERSHIP_DAYS",
                    "value": {
                        "days": 7
                    },
                    "pointTriggers": []
                }
            ]
        },
        {
            "tierName": "Elite Bonus",
            "referralRange": {
                "min": 20,
                "max": 20
            },
            "vestingDays": 7,
            "benefits": [
                {
                    "description": "90 days free membership",
                    "type": "FREE_MEMBERSHIP_DAYS",
                    "value": {
                        "days": 90
                    },
                    "pointTriggers": []
                }
            ]
        }
    ]
}
```

### 4. Bonus Content (`CONTENT`)

#### Referee Example - File Upload

```json
{
    "tiers": [
        {
            "tierName": "benefit",
            "referralRange": {
                "min": 1,
                "max": 1
            },
            "vestingDays": 7,
            "benefits": [
                {
                    "description": "Welcome Bonus Guide",
                    "type": "CONTENT",
                    "value": {
                        "deliveryMediums": ["EMAIL"],
                        "templateId": "template_1",
                        "subject": null,
                        "body": null,
                        "fileIds": ["file-123-abc-456"]
                    },
                    "pointTriggers": []
                }
            ]
        }
    ]
}
```

#### Referee Example - External Link

```json
{
    "tiers": [
        {
            "tierName": "benefit",
            "referralRange": {
                "min": 1,
                "max": 1
            },
            "vestingDays": 7,
            "benefits": [
                {
                    "description": "Exclusive Online Course",
                    "type": "CONTENT",
                    "value": {
                        "deliveryMediums": ["EMAIL", "WHATSAPP"],
                        "templateId": "template_2",
                        "subject": null,
                        "body": null,
                        "contentUrl": "https://example.com/exclusive-course"
                    },
                    "pointTriggers": []
                }
            ]
        }
    ]
}
```

#### Referrer Example - File Upload with Multiple Delivery Methods

```json
{
    "tiers": [
        {
            "tierName": "Content Creator",
            "referralRange": {
                "min": 3,
                "max": 3
            },
            "vestingDays": 7,
            "benefits": [
                {
                    "description": "Exclusive Training Materials",
                    "type": "CONTENT",
                    "value": {
                        "deliveryMediums": ["EMAIL", "WHATSAPP"],
                        "templateId": "template_2",
                        "subject": null,
                        "body": null,
                        "fileIds": ["training-video-789", "study-guide-101"]
                    },
                    "pointTriggers": []
                }
            ]
        }
    ]
}
```

#### Referrer Example - External Link

```json
{
    "tiers": [
        {
            "tierName": "Master Trainer",
            "referralRange": {
                "min": 15,
                "max": 15
            },
            "vestingDays": 7,
            "benefits": [
                {
                    "description": "Advanced Course Bundle",
                    "type": "CONTENT",
                    "value": {
                        "deliveryMediums": ["EMAIL", "WHATSAPP"],
                        "templateId": "template_3",
                        "subject": null,
                        "body": null,
                        "contentUrl": "https://academy.example.com/advanced-bundle"
                    },
                    "pointTriggers": []
                }
            ]
        }
    ]
}
```

#### Mixed Content Types Example

```json
{
    "tiers": [
        {
            "tierName": "Starter Package",
            "referralRange": {
                "min": 1,
                "max": 1
            },
            "vestingDays": 7,
            "benefits": [
                {
                    "description": "Welcome PDF Guide",
                    "type": "CONTENT",
                    "value": {
                        "deliveryMediums": ["EMAIL"],
                        "templateId": "template_1",
                        "subject": null,
                        "body": null,
                        "fileIds": ["welcome-guide-pdf-123"]
                    },
                    "pointTriggers": []
                }
            ]
        },
        {
            "tierName": "Pro Package",
            "referralRange": {
                "min": 5,
                "max": 5
            },
            "vestingDays": 7,
            "benefits": [
                {
                    "description": "Online Course Access",
                    "type": "CONTENT",
                    "value": {
                        "deliveryMediums": ["EMAIL", "WHATSAPP"],
                        "templateId": "template_2",
                        "subject": null,
                        "body": null,
                        "contentUrl": "https://courses.example.com/pro-access"
                    },
                    "pointTriggers": []
                }
            ]
        }
    ]
}
```

### 5. Points System (`POINTS`)

#### Referee Example with Nested Rewards

```json
{
    "tiers": [
        {
            "tierName": "benefit",
            "referralRange": {
                "min": 1,
                "max": 1
            },
            "vestingDays": 7,
            "benefits": [
                {
                    "description": "Earn 100 points per referral",
                    "type": "POINTS",
                    "value": {
                        "points": 100
                    },
                    "pointTriggers": [
                        {
                            "pointsRequired": 500,
                            "benefits": [
                                {
                                    "description": "15% discount unlocked",
                                    "type": "PERCENTAGE_DISCOUNT",
                                    "value": {
                                        "percentage": 15,
                                        "maxDiscount": 15.0
                                    },
                                    "pointTriggers": []
                                }
                            ]
                        },
                        {
                            "pointsRequired": 1000,
                            "benefits": [
                                {
                                    "description": "₹1000 discount unlocked",
                                    "type": "FLAT_DISCOUNT",
                                    "value": {
                                        "amount": 1000
                                    },
                                    "pointTriggers": []
                                }
                            ]
                        }
                    ]
                }
            ]
        }
    ]
}
```

#### Referrer Example with Membership Rewards

```json
{
    "tiers": [
        {
            "tierName": "Points Collector",
            "referralRange": {
                "min": 1,
                "max": 1
            },
            "vestingDays": 7,
            "benefits": [
                {
                    "description": "Earn 50 points per referral",
                    "type": "POINTS",
                    "value": {
                        "points": 50
                    },
                    "pointTriggers": [
                        {
                            "pointsRequired": 200,
                            "benefits": [
                                {
                                    "description": "30 days membership unlocked",
                                    "type": "FREE_MEMBERSHIP_DAYS",
                                    "value": {
                                        "days": 30
                                    },
                                    "pointTriggers": []
                                }
                            ]
                        }
                    ]
                }
            ]
        },
        {
            "tierName": "Points Master",
            "referralRange": {
                "min": 10,
                "max": 10
            },
            "vestingDays": 7,
            "benefits": [
                {
                    "description": "Earn 150 points per referral",
                    "type": "POINTS",
                    "value": {
                        "points": 150
                    },
                    "pointTriggers": [
                        {
                            "pointsRequired": 750,
                            "benefits": [
                                {
                                    "description": "25% discount unlocked",
                                    "type": "PERCENTAGE_DISCOUNT",
                                    "value": {
                                        "percentage": 25,
                                        "maxDiscount": 25.0
                                    },
                                    "pointTriggers": []
                                }
                            ]
                        },
                        {
                            "pointsRequired": 1500,
                            "benefits": [
                                {
                                    "description": "90 days membership unlocked",
                                    "type": "FREE_MEMBERSHIP_DAYS",
                                    "value": {
                                        "days": 90
                                    },
                                    "pointTriggers": []
                                }
                            ]
                        }
                    ]
                }
            ]
        }
    ]
}
```

## Complex Multi-Tier Referrer Example

### Complete Referrer Program with All Reward Types

```json
{
    "tiers": [
        {
            "tierName": "Welcome Tier",
            "referralRange": {
                "min": 1,
                "max": 1
            },
            "vestingDays": 7,
            "benefits": [
                {
                    "description": "10% discount reward",
                    "type": "PERCENTAGE_DISCOUNT",
                    "value": {
                        "percentage": 10,
                        "maxDiscount": 10.0
                    },
                    "pointTriggers": []
                }
            ]
        },
        {
            "tierName": "Bronze Tier",
            "referralRange": {
                "min": 5,
                "max": 5
            },
            "vestingDays": 7,
            "benefits": [
                {
                    "description": "₹500 flat discount",
                    "type": "FLAT_DISCOUNT",
                    "value": {
                        "amount": 500
                    },
                    "pointTriggers": []
                }
            ]
        },
        {
            "tierName": "Silver Tier",
            "referralRange": {
                "min": 10,
                "max": 10
            },
            "vestingDays": 7,
            "benefits": [
                {
                    "description": "Exclusive Study Materials",
                    "type": "CONTENT",
                    "value": {
                        "deliveryMediums": ["EMAIL", "WHATSAPP"],
                        "templateId": "template_2",
                        "subject": null,
                        "body": null,
                        "fileIds": ["study-materials-silver-001"]
                    },
                    "pointTriggers": []
                }
            ]
        },
        {
            "tierName": "Gold Tier",
            "referralRange": {
                "min": 20,
                "max": 20
            },
            "vestingDays": 7,
            "benefits": [
                {
                    "description": "60 days free membership",
                    "type": "FREE_MEMBERSHIP_DAYS",
                    "value": {
                        "days": 60
                    },
                    "pointTriggers": []
                }
            ]
        },
        {
            "tierName": "Platinum Tier",
            "referralRange": {
                "min": 50,
                "max": 50
            },
            "vestingDays": 7,
            "benefits": [
                {
                    "description": "Earn 200 points per referral",
                    "type": "POINTS",
                    "value": {
                        "points": 200
                    },
                    "pointTriggers": [
                        {
                            "pointsRequired": 1000,
                            "benefits": [
                                {
                                    "description": "30% discount unlocked",
                                    "type": "PERCENTAGE_DISCOUNT",
                                    "value": {
                                        "percentage": 30,
                                        "maxDiscount": 30.0
                                    },
                                    "pointTriggers": []
                                }
                            ]
                        },
                        {
                            "pointsRequired": 2000,
                            "benefits": [
                                {
                                    "description": "₹2000 discount unlocked",
                                    "type": "FLAT_DISCOUNT",
                                    "value": {
                                        "amount": 2000
                                    },
                                    "pointTriggers": []
                                }
                            ]
                        }
                    ]
                }
            ]
        }
    ]
}
```

## Content Delivery Options

### Available Delivery Mediums

-   `"EMAIL"` - Deliver content via email
-   `"WHATSAPP"` - Deliver content via WhatsApp

### Template Options

-   `"template_1"` - Basic template
-   `"template_2"` - Enhanced template
-   `"template_3"` - Premium template
-   `"TEMPLATE_DEFAULT"` - Default system template

## Field Descriptions

### Common Fields

-   **`tierName`**: Human-readable name for the tier
-   **`referralRange.min/max`**: Number of referrals required to unlock this tier
-   **`vestingDays`**: Days before reward becomes available
-   **`description`**: User-friendly description of the reward
-   **`type`**: The benefit type (see reward types above)
-   **`pointTriggers`**: Array of point thresholds that unlock additional benefits

### Content-Specific Fields

-   **`deliveryMediums`**: Array of delivery methods (`["EMAIL"]`, `["WHATSAPP"]`, or `["EMAIL", "WHATSAPP"]`)
-   **`templateId`**: Template to use for content delivery (`"template_1"`, `"template_2"`, `"template_3"`, or `"TEMPLATE_DEFAULT"`)
-   **`fileIds`**: Array of uploaded file IDs (used for file upload content)
-   **`contentUrl`**: External URL for link-based content (used for external link content)
-   **`subject`**: Email subject (optional, currently null)
-   **`body`**: Email body (optional, currently null)

**Note**: Use either `fileIds` for uploaded files OR `contentUrl` for external links, not both.

### Points System Fields

-   **`points`**: Points awarded per referral
-   **`pointsRequired`**: Points needed to unlock nested benefit
-   **`benefits`**: Array of benefits unlocked at point threshold

## Notes

1. **File IDs**: The `fileIds` array contains actual uploaded file IDs from the file upload system
2. **External Links**: The `contentUrl` field contains direct URLs to external content (courses, videos, etc.)
3. **Content Types**: Use `fileIds` for uploaded files OR `contentUrl` for external links, not both
4. **Templates**: Template selection affects how content is presented to users
5. **Delivery Methods**: Multiple delivery methods can be selected for content rewards
6. **Nesting**: Points system supports nested rewards with point thresholds
7. **Validation**: All amounts should be positive numbers, days should be positive integers
8. **Currency**: The system uses INR (Indian Rupees) for monetary values

## API Integration

These JSON structures are used in:

-   **`referrer_discount_json`**: Contains the referrer tiers structure
-   **`referee_discount_json`**: Contains the referee reward structure
-   **API Endpoints**: `/api/referral-options` for CRUD operations

The conversion between UI form data and these JSON structures is handled by the `convertToApiFormat` and `convertFromApiFormat` functions in `src/services/referral.ts`.
