# Payment Dialog UI Test Suite

## 🎯 **Purpose**
This test suite allows you to view and test all payment dialog UI states without any conditions or API calls. Perfect for UI testing, design review, and development.

## 🚀 **How to Access**

### **Option 1: Direct URL**
Navigate to: `http://localhost:3000/payment-dialog-test`

### **Option 2: Add to Navigation**
Add a link in your navigation menu:
```tsx
<Link to="/payment-dialog-test">Payment Dialog Test</Link>
```

## 🎨 **Available Dialog States**

| **Button** | **Dialog State** | **Purpose** |
|------------|------------------|-------------|
| **Test Payment Pending (Polling)** | `PaymentStatusPollingDialog` with `PAYMENT_PENDING` | Shows payment pending with email instructions |
| **Test Payment Paid (Polling)** | `PaymentStatusPollingDialog` with `PAID` | Shows payment success without polling |
| **Test Payment Failed (Polling)** | `PaymentStatusPollingDialog` with `FAILED` | Shows payment failure state |
| **Test Polling Error** | `PaymentStatusPollingDialog` with `ERROR` | Shows error state with retry option |
| **Test Success (No Approval)** | `PaymentSuccessDialog` with `approvalRequired: false` | Shows success with "Explore Course" button |
| **Test Success (With Approval)** | `PaymentSuccessDialog` with `approvalRequired: true` | Shows success with approval pending message |
| **Test Payment Failed** | `PaymentFailedDialog` | Shows failed payment with retry option |
| **Test Pending Approval** | Custom approval dialog | Shows enrollment pending approval state |

## 🔧 **Features**

### **Interactive Testing**
- ✅ Click any button to open the corresponding dialog
- ✅ Test all dialog states independently
- ✅ See real-time status indicators
- ✅ Test button interactions and callbacks

### **Visual Testing**
- ✅ View all UI variations side by side
- ✅ Test responsive design on different screen sizes
- ✅ Verify color schemes and animations
- ✅ Check typography and spacing

### **Development Benefits**
- ✅ No API calls or conditions required
- ✅ Instant feedback on UI changes
- ✅ Easy to share with stakeholders
- ✅ Perfect for design reviews

## 📱 **Responsive Testing**

The test suite is fully responsive and works on:
- 📱 Mobile devices (320px+)
- 📱 Tablets (768px+)
- 💻 Desktop (1024px+)
- 🖥️ Large screens (1440px+)

## 🎨 **UI Components Tested**

### **PaymentStatusPollingDialog**
- **PENDING**: Clock icon + email instructions + progress indicator
- **PAID**: Success icons + course access message
- **FAILED**: Error icons + retry instructions
- **ERROR**: Error details + retry button

### **PaymentSuccessDialog**
- **No Approval**: Green theme + "Explore Course" button
- **With Approval**: Yellow theme + approval process steps

### **PaymentFailedDialog**
- **Failed State**: Red theme + retry options + support guidance

### **EnrollmentPendingApprovalDialog**
- **Pending State**: Yellow theme + approval process + waiting message

## 🔍 **Debugging Features**

### **Console Logging**
All dialog interactions are logged to the console:
```javascript
// Example console output
Payment success callback triggered
Payment failed callback triggered
Explore course callback triggered
Try again callback triggered
```

### **Status Indicators**
The test page shows real-time status of all dialogs:
- ✅ **Green**: Dialog is currently open
- ❌ **Gray**: Dialog is closed

## 🚀 **Quick Start**

1. **Start your development server**:
   ```bash
   npm run dev
   # or
   yarn dev
   # or
   pnpm dev
   ```

2. **Navigate to the test page**:
   ```
   http://localhost:3000/payment-dialog-test
   ```

3. **Click any button** to test different dialog states

4. **Use "Close All Dialogs"** to reset all states

## 🎯 **Use Cases**

### **For Developers**
- Test UI changes before deployment
- Verify responsive design
- Debug dialog interactions
- Test different screen sizes

### **For Designers**
- Review visual design
- Test color schemes
- Verify typography
- Check spacing and layout

### **For QA**
- Test all dialog states
- Verify button functionality
- Check error handling
- Test user flows

### **For Stakeholders**
- Review UI/UX design
- See all possible states
- Provide feedback
- Approve designs

## 🔧 **Customization**

To add new dialog states or modify existing ones:

1. **Add new button** in `PaymentDialogUITest.tsx`:
   ```tsx
   <MyButton onClick={() => openDialog('newDialogState')}>
     Test New Dialog
   </MyButton>
   ```

2. **Add new state** in the `DialogState` interface:
   ```tsx
   interface DialogState {
     // ... existing states
     newDialogState: boolean;
   }
   ```

3. **Add new dialog** in the render section:
   ```tsx
   <NewDialog
     open={dialogs.newDialogState}
     onClose={() => closeDialog('newDialogState')}
     // ... other props
   />
   ```

## 📝 **Notes**

- All dialogs use mock data for testing
- No actual API calls are made
- All callbacks are logged to console
- Perfect for development and testing
- Safe to use in production (test route only)

---

**Happy Testing! 🎉**
