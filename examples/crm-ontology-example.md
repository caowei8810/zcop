# ZCOP CRM System Example

This is a complete CRM system example that demonstrates the power of ZeroCode Ontology Platform. This example includes all necessary entities, properties, relations, actions, and rules to create a fully functional CRM system that can be operated through natural language.

## Ontology Definition

### Entities

#### Customer
- **Description**: Represents a customer in the system
- **Properties**:
  - id (STRING, UNIQUE, REQUIRED) - Customer unique identifier
  - name (STRING, REQUIRED) - Customer name
  - email (STRING, UNIQUE) - Customer email address
  - phone (STRING) - Customer phone number
  - company (STRING) - Customer company name
  - address (STRING) - Customer address
  - city (STRING) - Customer city
  - state (STRING) - Customer state
  - zipCode (STRING) - Customer ZIP code
  - country (STRING) - Customer country
  - customerType (ENUM: ['Individual', 'Business'], DEFAULT: 'Individual') - Type of customer
  - status (ENUM: ['Prospect', 'Lead', 'Customer', 'Inactive'], DEFAULT: 'Prospect') - Customer status
  - createdDate (DATETIME, REQUIRED) - Date when customer was created
  - lastContactDate (DATETIME) - Date of last contact with customer
  - lifetimeValue (NUMBER, COMPUTED) - Calculated lifetime value of customer

#### Contact
- **Description**: Represents a contact person associated with a customer
- **Properties**:
  - id (STRING, UNIQUE, REQUIRED) - Contact unique identifier
  - firstName (STRING, REQUIRED) - Contact first name
  - lastName (STRING, REQUIRED) - Contact last name
  - email (STRING) - Contact email address
  - phone (STRING) - Contact phone number
  - title (STRING) - Contact job title
  - department (STRING) - Contact department
  - isPrimary (BOOLEAN, DEFAULT: false) - Whether this is the primary contact
  - createdDate (DATETIME, REQUIRED) - Date when contact was created

#### Product
- **Description**: Represents a product that can be sold
- **Properties**:
  - id (STRING, UNIQUE, REQUIRED) - Product unique identifier
  - name (STRING, REQUIRED) - Product name
  - sku (STRING, UNIQUE, REQUIRED) - Stock keeping unit identifier
  - description (STRING) - Product description
  - category (STRING) - Product category
  - price (NUMBER, REQUIRED) - Product price
  - cost (NUMBER) - Product cost
  - currency (STRING, DEFAULT: 'USD') - Currency for pricing
  - status (ENUM: ['Active', 'Inactive', 'Discontinued'], DEFAULT: 'Active') - Product status
  - createdDate (DATETIME, REQUIRED) - Date when product was created
  - lastUpdated (DATETIME) - Date when product was last updated

#### Order
- **Description**: Represents a customer order
- **Properties**:
  - id (STRING, UNIQUE, REQUIRED) - Order unique identifier
  - orderNo (STRING, UNIQUE, REQUIRED) - Order number
  - customerId (STRING, REQUIRED) - ID of the customer placing the order
  - orderDate (DATETIME, REQUIRED) - Date when order was placed
  - status (ENUM: ['Draft', 'Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'], DEFAULT: 'Draft') - Order status
  - totalAmount (NUMBER, COMPUTED) - Total order amount
  - taxAmount (NUMBER, COMPUTED) - Tax amount
  - discountAmount (NUMBER, DEFAULT: 0) - Discount applied to order
  - shippingCost (NUMBER, DEFAULT: 0) - Shipping cost
  - currency (STRING, DEFAULT: 'USD') - Currency for pricing
  - notes (STRING) - Additional notes about the order
  - createdDate (DATETIME, REQUIRED) - Date when order was created
  - shippedDate (DATETIME) - Date when order was shipped
  - deliveredDate (DATETIME) - Date when order was delivered

#### OrderItem
- **Description**: Represents an item within an order
- **Properties**:
  - id (STRING, UNIQUE, REQUIRED) - Order item unique identifier
  - orderId (STRING, REQUIRED) - ID of the order this item belongs to
  - productId (STRING, REQUIRED) - ID of the product in this item
  - quantity (NUMBER, REQUIRED, MIN: 1) - Quantity of the product ordered
  - unitPrice (NUMBER, REQUIRED) - Price per unit at time of order
  - lineTotal (NUMBER, COMPUTED) - Total for this line item (quantity * unitPrice)
  - createdDate (DATETIME, REQUIRED) - Date when item was added to order

#### Invoice
- **Description**: Represents an invoice for an order
- **Properties**:
  - id (STRING, UNIQUE, REQUIRED) - Invoice unique identifier
  - invoiceNo (STRING, UNIQUE, REQUIRED) - Invoice number
  - orderId (STRING, REQUIRED) - ID of the order being invoiced
  - customerId (STRING, REQUIRED) - ID of the customer being invoiced
  - invoiceDate (DATETIME, REQUIRED) - Date when invoice was issued
  - dueDate (DATETIME) - Date when payment is due
  - status (ENUM: ['Draft', 'Sent', 'Paid', 'Overdue', 'Cancelled'], DEFAULT: 'Draft') - Invoice status
  - totalAmount (NUMBER, COMPUTED) - Total invoice amount
  - paidAmount (NUMBER, DEFAULT: 0) - Amount paid toward invoice
  - outstandingAmount (NUMBER, COMPUTED) - Outstanding balance
  - currency (STRING, DEFAULT: 'USD') - Currency for pricing
  - notes (STRING) - Additional notes about the invoice
  - createdDate (DATETIME, REQUIRED) - Date when invoice was created

#### Interaction
- **Description**: Represents a communication interaction with a customer
- **Properties**:
  - id (STRING, UNIQUE, REQUIRED) - Interaction unique identifier
  - customerId (STRING, REQUIRED) - ID of the customer involved
  - contactId (STRING) - ID of the contact person involved
  - type (ENUM: ['Call', 'Email', 'Meeting', 'Task', 'Note'], REQUIRED) - Type of interaction
  - subject (STRING, REQUIRED) - Subject of the interaction
  - description (STRING) - Detailed description of the interaction
  - outcome (STRING) - Outcome or result of the interaction
  - priority (ENUM: ['Low', 'Medium', 'High', 'Critical'], DEFAULT: 'Medium') - Priority level
  - status (ENUM: ['Scheduled', 'Completed', 'Missed', 'Cancelled'], DEFAULT: 'Scheduled') - Status of interaction
  - scheduledDate (DATETIME) - Date when interaction was scheduled
  - completedDate (DATETIME) - Date when interaction was completed
  - createdBy (STRING, REQUIRED) - ID of user who created the interaction
  - createdDate (DATETIME, REQUIRED) - Date when interaction was created

### Relations

#### Customer -> Contact (ONE_TO_MANY)
- **Name**: has_contacts
- **Description**: A customer can have multiple contacts
- **Cardinality**: Customer (ONE) -> Contact (MANY)

#### Contact -> Customer (MANY_TO_ONE)
- **Name**: belongs_to_customer
- **Description**: A contact belongs to one customer
- **Cardinality**: Contact (MANY) -> Customer (ONE)

#### Customer -> Order (ONE_TO_MANY)
- **Name**: places_orders
- **Description**: A customer can place multiple orders
- **Cardinality**: Customer (ONE) -> Order (MANY)

#### Order -> Customer (MANY_TO_ONE)
- **Name**: placed_by_customer
- **Description**: An order is placed by one customer
- **Cardinality**: Order (MANY) -> Customer (ONE)

#### Order -> OrderItem (ONE_TO_MANY)
- **Name**: contains_items
- **Description**: An order contains multiple items
- **Cardinality**: Order (ONE) -> OrderItem (MANY)

#### OrderItem -> Order (MANY_TO_ONE)
- **Name**: part_of_order
- **Description**: An order item belongs to one order
- **Cardinality**: OrderItem (MANY) -> Order (ONE)

#### Product -> OrderItem (ONE_TO_MANY)
- **Name**: ordered_as_item
- **Description**: A product can be ordered as multiple items
- **Cardinality**: Product (ONE) -> OrderItem (MANY)

#### OrderItem -> Product (MANY_TO_ONE)
- **Name**: represents_product
- **Description**: An order item represents one product
- **Cardinality**: OrderItem (MANY) -> Product (ONE)

#### Order -> Invoice (ONE_TO_ONE)
- **Name**: invoiced_as
- **Description**: An order can be invoiced as one invoice
- **Cardinality**: Order (ONE) -> Invoice (ONE)

#### Invoice -> Order (ONE_TO_ONE)
- **Name**: for_order
- **Description**: An invoice is for one order
- **Cardinality**: Invoice (ONE) -> Order (ONE)

#### Customer -> Interaction (ONE_TO_MANY)
- **Name**: has_interactions
- **Description**: A customer can have multiple interactions
- **Cardinality**: Customer (ONE) -> Interaction (MANY)

#### Contact -> Interaction (ONE_TO_MANY)
- **Name**: involved_in_interactions
- **Description**: A contact can be involved in multiple interactions
- **Cardinality**: Contact (ONE) -> Interaction (MANY)

### Actions

#### Customer Actions
- **create_customer**: Create a new customer record
- **update_customer**: Update customer information
- **delete_customer**: Mark customer as inactive
- **search_customers**: Find customers based on criteria
- **get_customer_details**: Retrieve detailed customer information
- **convert_lead_to_customer**: Convert a lead to an active customer

#### Contact Actions
- **create_contact**: Create a new contact for a customer
- **update_contact**: Update contact information
- **make_primary_contact**: Set a contact as the primary contact for a customer
- **get_contacts_for_customer**: Retrieve all contacts for a specific customer

#### Product Actions
- **create_product**: Create a new product
- **update_product**: Update product information
- **archive_product**: Archive a product
- **search_products**: Find products based on criteria
- **get_product_details**: Retrieve detailed product information

#### Order Actions
- **create_order**: Create a new order
- **update_order**: Update order information
- **cancel_order**: Cancel an order
- **ship_order**: Mark an order as shipped
- **deliver_order**: Mark an order as delivered
- **calculate_order_total**: Calculate the total amount for an order
- **add_order_item**: Add an item to an order
- **remove_order_item**: Remove an item from an order

#### Invoice Actions
- **create_invoice**: Create an invoice for an order
- **send_invoice**: Send an invoice to the customer
- **mark_invoice_paid**: Mark an invoice as paid
- **generate_invoice_pdf**: Generate a PDF version of the invoice

#### Interaction Actions
- **schedule_interaction**: Schedule a new interaction
- **complete_interaction**: Mark an interaction as completed
- **log_interaction**: Log a completed interaction
- **get_customer_interactions**: Retrieve all interactions for a customer

### Rules

#### Validation Rules
1. **Customer Email Validation**: Customer email must match email format
2. **Phone Number Format**: Phone numbers must follow international format
3. **Product SKU Uniqueness**: Product SKU must be unique across all products
4. **Order Status Transition**: Orders can only transition to valid next statuses
5. **Quantity Positive**: Order item quantities must be positive
6. **Price Non-Negative**: Product prices must be non-negative

#### Computation Rules
1. **Order Total Calculation**: Total = SUM(items.quantity * items.unitPrice) + shipping - discount
2. **Tax Calculation**: Tax amount calculated based on order total and tax rate
3. **Invoice Balance**: Outstanding amount = total - paid amount
4. **Customer Lifetime Value**: Calculated based on all orders from the customer
5. **Last Contact Date**: Updated whenever a new interaction is logged

#### Trigger Rules
1. **Update Customer Last Contact**: When an interaction is completed, update the customer's last contact date
2. **Send Order Confirmation**: When an order status changes to "Confirmed", send confirmation email
3. **Create Invoice**: When an order status changes to "Confirmed", automatically create an invoice
4. **Update Product Inventory**: When an order is shipped, update product inventory levels
5. **Send Payment Reminder**: When an invoice becomes overdue, send a payment reminder

## Sample Natural Language Queries

Once this ontology is loaded into ZCOP, users can perform operations using natural language:

- "Create a new customer named John Smith with email john@example.com"
- "Find all customers in California with status 'Lead'"
- "Create an order for customer John Smith with product iPhone 15"
- "Show me all orders for customer ID 123 that haven't been shipped"
- "Calculate the total revenue from customer John Smith"
- "Schedule a follow-up call with John Smith next Tuesday"
- "Mark invoice INV-001 as paid"
- "Show me the top 10 customers by lifetime value"
- "Generate a sales report for the last quarter"
- "Convert lead John Smith to an active customer"

## Generated Business Processes

Based on this ontology, ZCOP's autonomous planning agent would generate workflows such as:

1. **Lead Conversion Process**: Steps to convert a lead to an active customer
2. **Order Fulfillment Process**: Complete workflow from order creation to delivery
3. **Invoice Generation Process**: Automatic invoice creation when orders are confirmed
4. **Payment Processing**: Workflow for handling invoice payments
5. **Follow-up Campaign**: Automated follow-up sequences for different customer types
6. **Sales Reporting**: Regular reports on sales performance, customer acquisition, etc.

This CRM example demonstrates how ZCOP can create a sophisticated business system with complex relationships and business logic entirely through graphical ontology definition, with no coding required by end users.