# 🚀 RMC Dialler - Deployment Guide

## 🚫 **Preventing Multiple Simultaneous Deployments**

### **The Problem**
Multiple deployments slow down the process and can cause conflicts. Here's how we prevent them:

---

## ⚡ **Quick Deploy (Recommended)**

```bash
# Use our smart deployment script
npm run deploy
```

This script will:
- ✅ Check for active deployments
- ✅ Verify you're on the right branch
- ✅ Test build locally first
- ✅ Only deploy if safe to do so

---

## 🛠️ **One-Time Setup**

Run this once to set up deployment safeguards:

```bash
# Enable git hooks to prevent problematic pushes
git config core.hooksPath .githooks

# Install Vercel CLI globally (if not already installed)
npm install -g vercel

# Verify setup
npm run check-deployments
```

---

## 📋 **Available Commands**

```bash
# Smart deployment (recommended)
npm run deploy

# Force deployment (bypass checks)
npm run deploy:force

# Check current deployments
npm run check-deployments

# Local build test
npm run build
```

---

## 🔄 **Deployment Workflow**

### **1. Before Making Changes**
```bash
git pull origin main
npm run check-deployments  # Ensure no active deployments
```

### **2. Development**
```bash
npm run dev                 # Test locally
npm run build              # Test build
```

### **3. Deployment**
```bash
git add .
git commit -m "your changes"
npm run deploy             # Smart deployment
```

---

## 🚨 **Emergency Procedures**

### **Multiple Deployments Running**
```bash
# Check what's running
npm run check-deployments

# Wait for them to finish (recommended)
# OR force a new deployment (cancels others)
npm run deploy:force
```

### **Stuck Deployment**
```bash
# New deployments automatically cancel old ones
npm run deploy:force

# Or wait for auto-timeout (usually 15 minutes)
```

---

## ⚙️ **Configuration Details**

### **Vercel Settings (`vercel.json`)**
- ✅ **Auto Job Cancellation**: Newer deployments cancel older ones
- ✅ **Branch Restrictions**: Only `main` branch auto-deploys
- ✅ **No Auto Aliasing**: Prevents multiple deployment triggers

### **Git Hooks (`.githooks/pre-push`)**
- ✅ **Pre-push Check**: Blocks pushes if deployments are active
- ✅ **Smart Warnings**: Suggests alternatives

### **Smart Deploy Script (`scripts/deploy.sh`)**
- ✅ **Branch Verification**: Ensures you're on the right branch
- ✅ **Sync Check**: Verifies you're up to date with remote
- ✅ **Local Build**: Tests build before deploying
- ✅ **Deployment Status**: Checks for active deployments

---

## 🎯 **Best Practices**

### **DO:**
- ✅ Use `npm run deploy` for all deployments
- ✅ Wait for deployments to finish before starting new ones
- ✅ Test builds locally first
- ✅ Keep commits small and focused

### **DON'T:**
- ❌ Push directly without checking deployment status
- ❌ Make multiple rapid commits/pushes
- ❌ Use `vercel --prod` directly (use our scripts instead)
- ❌ Force deploy unless emergency

---

## 🔧 **Troubleshooting**

### **Hook Not Working?**
```bash
# Ensure hooks are enabled
git config core.hooksPath .githooks
chmod +x .githooks/pre-push
```

### **Script Permission Denied?**
```bash
# Make scripts executable
chmod +x scripts/deploy.sh
```

### **Can't Check Deployments?**
```bash
# Install Vercel CLI
npm install -g vercel
vercel login
```

---

## 📊 **Monitoring**

Check deployment status anytime:
```bash
npm run check-deployments
```

Or visit: [Vercel Dashboard](https://vercel.com/james-campbells-projects-6c4e4922/rmcdialer)

---

**💡 Remember**: One deployment at a time = faster, more reliable deployments! 