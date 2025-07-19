# 📋 CDC Implementation Checklist

This is your step-by-step checklist for implementing Change Data Capture (CDC) to eliminate cache staleness issues.

## 🎯 **Goal**: Real-time cache invalidation when users sign documents or change status

**Timeline**: 2-3 weeks  
**Effort**: Medium complexity, high impact

---

## **✅ Week 1: Infrastructure Setup**

### **Day 1: AWS Infrastructure** 
- [ ] **Install AWS CLI** and configure credentials
- [ ] **Run infrastructure setup**:
  ```bash
  chmod +x scripts/setup-cdc-infrastructure.sh
  ./scripts/setup-cdc-infrastructure.sh
  ```
- [ ] **Copy environment variables** from script output to `.env` file
- [ ] **Test SQS access**:
  ```bash
  aws sqs receive-message --queue-url $SQS_QUEUE_URL --region $AWS_REGION
  ```

### **Day 2: DMS Configuration**
- [ ] **Verify database access** from AWS (security groups, VPC)
- [ ] **Run DMS setup**:
  ```bash
  ./scripts/setup-dms-replication.sh
  ```
- [ ] **Test DMS endpoints** in AWS Console
- [ ] **Start replication task**:
  ```bash
  aws dms start-replication-task \
    --replication-task-arn <arn-from-script> \
    --start-replication-task-type start-replication \
    --region $AWS_REGION
  ```

### **Day 3: Initial Testing**
- [ ] **Monitor DMS task** in AWS Console
- [ ] **Test manual database change** → check SQS for messages
- [ ] **Verify message format** matches expected structure
- [ ] **Document any issues** and troubleshoot

---

## **✅ Week 2: CDC Processing**

### **Day 4-5: Code Integration**
- [ ] **Test CDC health endpoint**:
  ```bash
  curl http://localhost:3000/api/cdc/health
  ```
- [ ] **Start CDC processor locally**:
  ```bash
  npm run cdc:start
  ```
- [ ] **Monitor logs** for any startup issues
- [ ] **Test manual cache invalidation**:
  ```bash
  curl -X POST http://localhost:3000/api/cdc/health \
    -H "Content-Type: application/json" \
    -d '{"userId": 9748}'
  ```

### **Day 6-7: Integration Testing**
- [ ] **Test real database changes**:
  - Update user signature in main database
  - Verify SQS message received
  - Confirm cache invalidation triggered
  - Check queue transition (unsigned → outstanding)
- [ ] **Test requirement changes**:
  - Update requirement status in main database  
  - Verify cache invalidation for user
  - Confirm queue refresh
- [ ] **Test error handling**:
  - Invalid message format
  - Database connection issues
  - SQS access problems

---

## **✅ Week 3: Production Deployment**

### **Day 8-9: Production Setup**
- [ ] **Create production SQS queues**
- [ ] **Setup production DMS instance**
- [ ] **Configure production environment variables**
- [ ] **Deploy CDC processor** to production environment

### **Day 10-11: Monitoring & Alerting**
- [ ] **Setup CloudWatch alarms**:
  - DMS task health
  - SQS queue depth
  - CDC processor errors
- [ ] **Configure log aggregation**
- [ ] **Test alerting** with simulated failures
- [ ] **Document runbook** for common issues

### **Day 12-14: Load Testing & Optimization**
- [ ] **Simulate high-volume changes**
- [ ] **Monitor performance metrics**:
  - Message processing latency
  - Cache invalidation speed
  - Database query reduction
- [ ] **Optimize batch processing** if needed
- [ ] **Performance baseline documentation**

---

## **🔧 Testing Scenarios**

### **Primary Use Case: Signature Status Change**
1. **Setup**: User 9748 in unsigned_users queue (missing signature)
2. **Action**: Update `current_signature_file_id` in main database
3. **Expected**:
   - DMS captures change within 2 seconds
   - SQS message received by CDC processor
   - User cache invalidated immediately
   - Queue caches invalidated
   - Next queue refresh shows user in outstanding_requests
   - **Total latency: Under 10 seconds**

### **Secondary Use Case: Requirement Completion**
1. **Setup**: User with pending requirements
2. **Action**: Update requirement status to 'COMPLETED'
3. **Expected**:
   - Cache invalidated for user
   - User moves out of outstanding_requests queue if no more pending requirements

### **Error Handling**
1. **SQS Unavailable**: Processor should retry with exponential backoff
2. **Database Timeout**: Cache invalidation should fail gracefully
3. **Invalid Message**: Should move to dead letter queue after 3 attempts

---

## **📊 Success Metrics**

### **User Experience**
- [ ] **Cache staleness reduced** from 5 minutes to <10 seconds
- [ ] **Eliminated "already completed" calls** to users
- [ ] **Queue accuracy improved** to >98%

### **Performance**
- [ ] **Database query reduction** of 60-80%
- [ ] **Queue refresh time** reduced to <2 seconds
- [ ] **Real-time queue transitions** working

### **Reliability**
- [ ] **Message processing success rate** >99%
- [ ] **CDC uptime** >99.5%
- [ ] **Error recovery** <30 seconds

---

## **🚨 Troubleshooting Guide**

### **DMS Issues**
```bash
# Check replication task status
aws dms describe-replication-tasks \
  --filters Name=replication-task-id,Values=rmc-dialler-cdc-task-production

# View task logs
aws logs describe-log-streams --log-group-name dms-tasks-rmc-dialler-cdc-task-production
```

### **SQS Issues**
```bash
# Check queue attributes
aws sqs get-queue-attributes \
  --queue-url $SQS_QUEUE_URL \
  --attribute-names All

# Check dead letter queue
aws sqs receive-message --queue-url $SQS_DLQ_URL
```

### **CDC Processor Issues**
```bash
# Check health status
curl http://localhost:3000/api/cdc/health

# View processor logs
npm run cdc:start | grep ERROR

# Test manual invalidation
curl -X POST http://localhost:3000/api/cdc/health \
  -d '{"userId": 123}' \
  -H "Content-Type: application/json"
```

---

## **🎯 Rollback Plan**

If CDC implementation fails:

1. **Stop CDC processor**: Kill CDC background service
2. **Disable DMS task**: Stop replication task in AWS Console
3. **Revert to aggressive TTL**: Update cache TTLs to 60-180 seconds
4. **Monitor performance**: Ensure system stability
5. **Investigate issues**: Review logs and fix problems
6. **Retry deployment**: When issues resolved

---

## **💰 Cost Monitoring**

### **Expected Monthly Costs**
- **DMS Instance**: ~$75/month (t3.micro)
- **SQS Messages**: ~$10-15/month 
- **CloudWatch Logs**: ~$5/month
- **Total**: ~$90-95/month

### **Cost Optimization**
- [ ] **Monitor DMS utilization** - downsize if possible
- [ ] **Set SQS message retention** to 7 days max
- [ ] **Use CloudWatch log retention** policies
- [ ] **Review costs monthly** and optimize

---

## **🚀 Next Steps After CDC**

Once CDC is working:

1. **Advanced Features**:
   - Real-time agent notifications
   - Business intelligence on transitions
   - Predictive queue management

2. **Performance Enhancements**:
   - Batch cache invalidation
   - Selective queue refreshing  
   - Memory cache optimization

3. **Business Intelligence**:
   - Queue transition analytics
   - Agent performance correlation
   - User behavior insights

**CDC sets the foundation for these advanced capabilities!** 🎉 