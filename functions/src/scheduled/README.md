# Scheduled Functions

## Customer Metrics Refresh

### Function: `refreshCustomerMetricsNightly`

**Schedule**: Every day at 2:00 AM Pacific Time (PST/PDT)

**Purpose**: Automatically refreshes the `customer_sales_summary` collection with the latest metrics from Fishbowl sales data.

**What it does**:
1. Loads all customers from `fishbowl_customers`
2. Loads all sales orders from `fishbowl_sales_orders`
3. Aggregates sales data by customer
4. Calculates comprehensive metrics for each customer:
   - Lifetime value and YTD sales
   - Order counts (total, YTD, 30d, 90d, 12m)
   - Average order value
   - Velocity (orders per month)
   - Trend (% change in sales)
   - Days since last order
   - Monthly sales breakdown
   - Regional information
   - Sales rep assignments

**Performance**:
- Processes customers in batches of 50
- Timeout: 9 minutes
- Memory: 2GB
- Logs progress and results to `scheduled_job_logs` collection

**Monitoring**:
Check the `scheduled_job_logs` collection for execution history:
```javascript
db.collection('scheduled_job_logs')
  .where('jobName', '==', 'refreshCustomerMetrics')
  .orderBy('timestamp', 'desc')
  .limit(10)
```

**Manual Trigger**:
You can also manually trigger the refresh via the API:
```bash
POST http://localhost:3000/api/migrate-customer-summary
```

**Deployment**:
```bash
cd functions
npm run deploy
```

Or deploy just this function:
```bash
firebase deploy --only functions:refreshCustomerMetricsNightly
```

**Logs**:
View logs in Firebase Console or via CLI:
```bash
firebase functions:log --only refreshCustomerMetricsNightly
```

**Cost Considerations**:
- Runs once per day (2 AM PST)
- Processing time depends on number of customers and orders
- Typical execution: 2-5 minutes for 1000+ customers
- Uses 2GB memory to handle large datasets efficiently
