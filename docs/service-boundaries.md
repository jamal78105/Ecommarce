                         ┌─────────────────────────┐
                         │      API / Client       │
                         └────────────┬────────────┘
                                      │
                                      ▼
                    ┌─────────────────────────────────┐
                    │       Identity Service          │
                    │                                 │
                    │  Authentication + User          │
                    │  Login / Register / Roles       │
                    │  Sessions / Refresh Tokens      │
                    └───────────────┬─────────────────┘
                                    │
                                    ▼
                           ┌────────────────┐
                           │  identity_db   │
                           └────────────────┘


       ┌──────────────────┐       ┌──────────────────┐
       │ Product Service  │       │Inventory Service │
       │                  │       │                  │
       │ Products         │       │ Stock            │
       │ Categories       │       │ Reservations     │
       │ Variants         │       │ Warehouses       │
       └────────┬─────────┘       └────────┬─────────┘
                │                          │
                ▼                          ▼
        ┌──────────────┐           ┌──────────────┐
        │ product_db   │           │ inventory_db │
        └──────────────┘           └──────────────┘


       ┌──────────────────┐       ┌──────────────────┐
       │   Cart Service   │       │  Order Service   │
       │                  │       │                  │
       │ Carts            │       │ Orders           │
       │ Cart Items       │       │ Order Items      │
       └────────┬─────────┘       │ Status History  │
                │                 └────────┬─────────┘
                ▼                          ▼
        ┌──────────────┐           ┌──────────────┐
        │   cart_db    │           │   order_db   │
        └──────────────┘           └──────────────┘


       ┌──────────────────┐       ┌──────────────────┐
       │ Payment Service  │       │Shipping Service  │
       │                  │       │                  │
       │ Payments         │       │ Shipments        │
       │ Transactions     │       │ Tracking         │
       │ Refunds          │       │ Addresses        │
       └────────┬─────────┘       └────────┬─────────┘
                │                          │
                ▼                          ▼
        ┌──────────────┐           ┌──────────────┐
        │ payment_db   │           │ shipping_db  │
        └──────────────┘           └──────────────┘


                         ┌──────────────────────┐
                         │ Notification Service │
                         │                      │
                         │ Notifications        │
                         │ Templates            │
                         └──────────┬───────────┘
                                    │
                                    ▼
                           ┌──────────────────┐
                           │ notification_db  │
                           └──────────────────┘