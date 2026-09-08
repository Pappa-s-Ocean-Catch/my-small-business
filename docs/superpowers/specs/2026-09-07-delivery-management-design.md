# Delivery Management and Delivery On Demand

User approved standalone courier jobs with an optional existing POS order link. Implement inside the Expo POS drawer, using staff-authenticated Next.js APIs and the existing Shipday account. Keep all work uncommitted; do not apply migrations or make real courier bookings during development.

## Experience

Delivery Management lists Shipday account deliveries, including records created outside POS. Search by reference/customer/address; filter status and date range, paginate, refresh, open details. Show recipient, pickup/dropoff, courier, status, cost, timing, tracking and expandable complete provider data. Tablet list/detail layout; phone stacked navigation. Use existing navy brand, Paper controls, 48dp targets and explicit loading/errors.

New delivery: store pickup prefilled, dropoff address autocomplete/manual fallback, get all available provider quotes, select a quote, recipient name and phone (email/instructions optional), optional existing POS order ID/reference lookup, Request delivery. Standalone requests never create food sales. Linked POS details prefill recipient/address; prevent attaching another delivery to an already linked order. Show progress and saved delivery reference immediately. Completed booking opens delivery details. No implicit SMS/payment-link sending.

## Provider operations

Use current official API contracts: POST /orders/query with UTC date bounds and cursor pagination; GET /orders/{merchantReference} returns an array and must match the linked Shipday ID. POST /on-demand/availability previews all provider options using store pickup and dropoff; POST /orders creates the delivery; GET /on-demand/estimate/{id} gets booking estimates; POST /on-demand/assign explicitly books selected provider using estimateReference; GET /on-demand/details/{id} provides courier/tracking/billing details. Account settings may affect courier availability; never claim booking success from order insertion alone.

https://docs.shipday.com/reference/delivery-orders-query
https://docs.shipday.com/reference/availability-1
https://docs.shipday.com/reference/estimate
https://docs.shipday.com/reference/assign
https://docs.shipday.com/reference/insert-delivery-order

## Durable booking

New delivery_requests table stores quote options, address, recipient, optional order link, stable DOD reference, Shipday ID, state and errors. Authenticated staff can read; only server service role mutates. Quote request ID also identifies a booking attempt; concurrent/repeated submissions cannot create or assign twice. Create local record before remote mutations. Persist Shipday ID before assignment. After remote timeout, retain an uncertain state and reconcile via provider reads; never blindly repeat creation/assignment. Re-estimate before booking; price increases or provider changes require staff to accept the replacement quote. Existing linked Shipday orders cannot be dispatched again through this flow. Webhook updates delivery_requests and linked orders using the existing status reconciliation.

## Shared contracts (libs/types/delivery-management.ts)

DeliveryJobAddress: address_line1:string, address_line2?:string, city:string, state:string, postcode:string, country?:string, latitude?:number, longitude?:number, delivery_instructions?:string.
DeliveryQuoteOption: id:string|null, provider:string, fee:number, currency:string, pickupAt:string|null, deliveryAt:string|null, pickupMinutes:number|null, deliveryMinutes:number|null.
ShipdayDeliveryRecord: id:string, reference:string, status:string, customerName:string, customerPhone:string, pickupAddress:string, deliveryAddress:string, createdAt:string|null, driverName:string|null, driverPhone:string|null, trackingUrl:string|null, deliveryFee:number|null, raw:Record<string,unknown>.
ShipdayDeliveryPage: orders:ShipdayDeliveryRecord[], page:number, hasMore:boolean.
ShipdayDeliveryDetail: order:ShipdayDeliveryRecord, onDemand:Record<string,unknown>|null, onDemandError?:string.
DeliveryRequestState: 'quoted'|'creating'|'created'|'assigning'|'requested'|'needs_confirmation'|'creation_uncertain'|'assignment_uncertain'|'failed'.
DeliveryRequest: id:string, reference:string, state:DeliveryRequestState, shipdayOrderId:string|null, orderId:string|null, quotes:DeliveryQuoteOption[], expiresAt:string, error:string|null, trackingUrl:string|null.
DeliveryRecipient: name:string, phone:string, email?:string.

Provider module libs/shipday/management.ts exports getShipdayManagementClient(), getDeliveryStoreAddress():DeliveryJobAddress, getDeliveryAddressText(address):string. Client methods:
- listOrders({status?:string,from:string,to:string,page:number}):Promise<ShipdayDeliveryPage> (ALL fans out ACTIVE/ALREADY_DELIVERED/FAILED_DELIVERY/INCOMPLETE; stable merge)
- getOrderDetail(id:string,reference:string):Promise<ShipdayDeliveryDetail>
- findOrderByReference(reference:string):Promise<ShipdayDeliveryRecord|null>
- getQuotes(address:DeliveryJobAddress):Promise<DeliveryQuoteOption[]>
- createOrder({reference:string,address:DeliveryJobAddress,recipient:DeliveryRecipient}):Promise<string> (Shipday ID)
- getEstimates(id:string):Promise<DeliveryQuoteOption[]>
- assignDelivery(id:string,quote:DeliveryQuoteOption):Promise<Record<string,unknown>>
- getOnDemandDetails(id:string):Promise<Record<string,unknown>|null>
No environment values, customer payloads or authorization headers logged.

## Staff API contract

All responses {success:true,data:...} or {success:false,error:string}; booking business state returns success:true and DeliveryRequest even when needs_confirmation/uncertain/failed, so UI can display recovery.
GET /api/pos/delivery-management/orders?status=ACTIVE&from=ISO&to=ISO&page=1 -> ShipdayDeliveryPage.
GET /api/pos/delivery-management/orders/{id}?reference=... -> ShipdayDeliveryDetail.
GET /api/pos/delivery-management/lookup-order?reference=... -> {id,reference,recipient,address:DeliveryJobAddress|null,deliveryProviderId:string|null}.
POST /api/pos/delivery-management/quotes {address:DeliveryJobAddress} -> {request:DeliveryRequest,pickupAddress:DeliveryJobAddress}.
POST /api/pos/delivery-management/requests {quoteRequestId:string,provider:string,acceptedFee:number,currency:string,recipient:DeliveryRecipient,orderId?:string} -> DeliveryRequest.
GET /api/pos/delivery-management/requests/{id} -> DeliveryRequest (safe read reconciliation for uncertain states).

## Validation

Provider fixture tests: all quotes, errors/invalid fees, pagination, correct reference/ID, nested provider details, explicit assignment, no misleading success. Booking tests: validation/auth boundary, concurrent claim, double tap, price changes, timeout recovery, durable ID before assignment, no food sale, optional link protection. UI logic tests for quote invalidation and request/recovery state. Run web TypeScript, relevant POS emitted unit tests and app typecheck; report baseline errors separately. Document migration and deployed/device/provider evidence not executed.
