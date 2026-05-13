# In-House Online Delivery Integration Requirements (Shipday Fulfilment)

## 1. Overview

Implement an in-house online delivery system for the takeaway website using Shipday as the delivery fulfilment provider.

The website already supports pickup orders. This project adds:

- Delivery address validation
- Real-time delivery quote and ETA retrieval
- Delivery selection during checkout
- Online payment requirement for delivery orders
- Automatic Shipday order creation after successful payment
- Optional driver dispatch (disabled in local development)

---

# 2. Goals

## Business Goals

- Allow customers to order takeaway delivery directly from the restaurant website
- Avoid dependency on Uber Eats marketplace
- Use Shipday as delivery orchestration platform
- Support future integrations with:
  - Uber Direct
  - DoorDash Drive
  - In-house drivers

## Technical Goals

- Real-time delivery fee calculation
- Prevent invalid delivery addresses
- Ensure delivery fee accuracy at checkout
- Automate fulfilment workflow
- Separate development vs production delivery behavior

---

# 3. High Level Flow

```text
Customer enters delivery address
        ↓
Frontend requests quote from backend
        ↓
Backend requests delivery quote from Shipday
        ↓
Frontend displays:
  - Delivery fee
  - ETA
  - Delivery availability
        ↓
Customer builds cart
        ↓
Checkout begins
        ↓
Backend recalculates quote
        ↓
Customer confirms delivery option
        ↓
Customer pays online
        ↓
Order created internally
        ↓
Backend creates Shipday delivery order
        ↓
Production:
  Shipday dispatches driver

Local Development:
  Create Shipday order only
  DO NOT assign driver
```
