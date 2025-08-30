# 📊 **Enhanced User Details Structure**

## 🎯 **What's New**

The AI voice agent now receives **enriched user data** during calls, including:

1. **ID Document Status** - Whether user has uploaded ID
2. **Claims with Lenders** - Which lenders the claims are with
3. **Vehicle Packages** - Number and details of vehicles in each claim
4. **Total Vehicle Count** - Aggregate across all claims

## 📋 **Complete Data Structure**

### **When User IS Found**

```javascript
{
  found: true,
  id: 2064,
  firstName: "James",
  lastName: "Campbell",
  fullName: "James Campbell",
  status: "lead",                    // lead/customer/active
  hasIdOnFile: true,                 // NEW: ID document status
  phone: "+447738585850",
  email: "james@example.com",
  
  // Enhanced claims array with vehicle details
  claims: [
    {
      id: 12345,
      lender: "Santander",           // Lender name
      status: "reviewing",
      vehiclePackagesCount: 2,       // NEW: Number of vehicles
      vehiclePackages: [             // NEW: Vehicle details
        {
          registration: "AB12 CDE",
          make: "Ford",
          model: "Focus",
          dealership: "Main Street Motors",
          monthlyPayment: 299
        },
        {
          registration: "XY34 ZZZ",
          make: "Vauxhall",
          model: "Corsa",
          dealership: "City Cars",
          monthlyPayment: 199
        }
      ],
      estimatedValue: 3500
    }
  ],
  
  claimsCount: 1,
  totalVehiclePackages: 2,           // NEW: Total vehicles across all claims
  priorityScore: 60
}
```

### **When User NOT Found**

```javascript
{
  found: false,
  phone: "+447738585850",
  hasIdOnFile: false,
  firstName: null,
  lastName: null,
  fullName: null
}
```

## 🎭 **How the AI Uses This Data**

### **Example 1: User with Multiple Claims**
```
AI: "Hello James, I have your details here. You have 2 claims with us - 
one with Santander covering 2 vehicles, and one with Barclays for 1 vehicle. 
I notice you haven't uploaded your ID documents yet. How can I help today?"
```

### **Example 2: User with Single Vehicle Claim**
```
AI: "Hello Sarah, I can see you have 1 claim with Lloyds Bank for your 
Ford Focus. Your ID is on file and your claim status is currently under review."
```

### **Example 3: User Without ID**
```
AI: "Hello John, I have your claim details here with HSBC for 1 vehicle. 
I notice you haven't uploaded your ID documents yet - this is needed to 
progress your claim. Would you like me to send you a link to upload them?"
```

## 🔍 **What `check_user_details` Returns**

When the AI calls the `check_user_details` function, it now gets:

```javascript
{
  success: true,
  message: "I have your details here. You're James Campbell. I notice you 
           haven't uploaded your ID documents yet. You have 1 claim with 
           Santander (2 vehicles). Your current status is lead.",
  data: {
    name: "James Campbell",
    phone: "+447738585850",
    has_id_on_file: false,           // NEW
    claims_count: 1,
    total_vehicles: 2,               // NEW
    claims: [                        // NEW: Detailed claims array
      {
        lender: "Santander",
        status: "reviewing",
        vehicles_count: 2
      }
    ],
    status: "lead",
    user_id: 2064
  }
}
```

## 📈 **Database Fields Used**

| Table | Field | Purpose |
|-------|-------|---------|
| **users** | `current_user_id_document_id` | Check if ID is uploaded |
| **claims** | `lender` | Show which bank/lender |
| **claims** | `status` | Current claim status |
| **claim_vehicle_packages** | All fields | Vehicle details & count |

## 🎯 **Benefits**

1. **Proactive ID Reminders**: AI can remind users to upload ID if missing
2. **Specific Claim Discussion**: AI knows which lender and vehicles
3. **Accurate Information**: No need to ask what the claim is about
4. **Better Context**: AI understands the full scope of user's claims

## 💡 **Future Enhancements**

1. **Document Status**: Show which specific documents are missing
2. **Timeline Info**: Add expected completion dates
3. **Payment Calculations**: Show potential compensation amounts
4. **Previous Interactions**: Reference last call topics

---

**The AI now has complete visibility into user claims, vehicles, and document status!** 🚀
