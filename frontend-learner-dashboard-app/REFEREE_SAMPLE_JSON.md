## Basic Structure

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

## Content Delivery Options

### Available Delivery Mediums

- `"EMAIL"` - Deliver content via email
- `"WHATSAPP"` - Deliver content via WhatsApp

## Field Descriptions

### Common Fields

- **`vestingDays`**: Days before reward becomes available
- **`description`**: User-friendly description of the reward
- **`type`**: The benefit type (see reward types above)
- **`pointTriggers`**: Array of point thresholds that unlock additional benefits

### Content-Specific Fields

- **`deliveryMediums`**: Array of delivery methods (`["EMAIL"]`, `["WHATSAPP"]`, or `["EMAIL", "WHATSAPP"]`)
- **`fileIds`**: Array of uploaded file IDs (used for file upload content)
- **`contentUrl`**: External URL for link-based content (used for external link content)
