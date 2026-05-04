# AWS Deployment Guide for FoodShare Application

This is a complete step-by-step guide to deploy your FoodShare application on AWS. **Read through all steps first** before starting.

## Overview of What We'll Set Up

1. **Database**: MySQL on AWS RDS
2. **Server**: Node.js app on AWS EC2 or Elastic Beanstalk
3. **Domain**: Custom domain setup with Route 53
4. **Security**: SSL certificate and firewall rules
5. **Storage**: S3 for images (optional, for profile/donation images)

---

## PART 1: AWS Account Setup (10 minutes)

### Step 1.1: Create AWS Account
- Go to: https://aws.amazon.com/
- Click "Create an AWS Account"
- Provide email, password, and billing information
- AWS will send verification email

### Step 1.2: Set Up Security
- Go to AWS Console → IAM (Identity & Access Management)
- Create an IAM User for your application (not using root account)
- Set a strong password
- Save the Access Key ID and Secret Access Key (you'll need these)

### Step 1.3: Choose AWS Region
- Select a region closest to your users
- **For India**: Mumbai (ap-south-1) is recommended
- **For USA**: us-east-1 or us-west-2
- **Stick with ONE region** for all services

---

## PART 2: Database Setup (30 minutes)

### Step 2.1: Create RDS MySQL Database
1. Go to AWS Console → **RDS** (Relational Database Service)
2. Click "Create database"
3. Choose:
   - **Engine**: MySQL 8.0
   - **Template**: Free tier (if eligible)
   - **DB instance identifier**: `foodshare-db`
   - **Master username**: `admin`
   - **Master password**: Create a strong password (save it!)
   - **Storage**: 20 GB (free tier default)
   - **DB instance class**: db.t3.micro (free tier)

### Step 2.2: Configure Network Access
1. Still in RDS creation page, scroll to "Connectivity"
2. **VPC**: Default VPC (most cases)
3. **Public accessibility**: YES (so your server can connect)
4. **VPC security group**: Create new
   - Name: `foodshare-db-sg`
5. Click "Create database" and **wait 5-10 minutes** for creation

### Step 2.3: Get Database Connection Details
1. Go to AWS RDS → Databases → Select your database
2. Find and note:
   - **Endpoint**: (something like `foodshare-db.c12345.ap-south-1.rds.amazonaws.com`)
   - **Port**: 3306 (default)
   - **Username**: admin
   - **Password**: (what you created)
   - **Database name**: (will create next)

### Step 2.4: Create Database and Tables
1. Install **MySQL Workbench** on your computer or use online tool
2. Connect using the details from Step 2.3
3. Create database:
   ```sql
   CREATE DATABASE foodshare_db;
   USE foodshare_db;
   ```
4. Copy-paste contents from `database.sql` file and run it
5. Verify tables created: users, sessions, donations, delivery_otp

### Step 2.5: Update Security Group for Database
1. Go to AWS RDS → Databases → Your database
2. Under "Security groups", click on the security group
3. Go to "Inbound rules"
4. Add rule:
   - **Type**: MySQL/Aurora
   - **Protocol**: TCP
   - **Port**: 3306
   - **Source**: `0.0.0.0/0` (or restrict to your server's IP later)
   - Click "Save rules"

---

## PART 3: Prepare Your Code (15 minutes)

### Step 3.1: Update Environment Variables
1. Open `config.js` in your project
2. Ensure it reads from environment variables:

```javascript
const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'foodshare_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

module.exports = { DB_CONFIG };
```

### Step 3.2: Create `.env` File
Create a new file in your project root called `.env`:

```
DB_HOST=your-rds-endpoint.ap-south-1.rds.amazonaws.com
DB_USER=admin
DB_PASS=your-strong-password
DB_NAME=foodshare_db
NODE_ENV=production
PORT=3001
```

**IMPORTANT: Add `.env` to `.gitignore`**

### Step 3.3: Update server.js
Make sure you're loading dotenv at the very top:

```javascript
require('dotenv').config();
const express = require('express');
// ... rest of code
```

### Step 3.4: Test Locally
```bash
npm install
npm start
```
Verify app runs without errors.

---

## PART 4: Deploy Server (Choice: Option A or Option B)

### ⭐ OPTION A: Using EC2 (More Control, More Setup)

#### Step 4A.1: Launch EC2 Instance
1. Go to AWS Console → **EC2**
2. Click "Launch instances"
3. Configure:
   - **Name**: foodshare-server
   - **AMI** (OS): Amazon Linux 2 or Ubuntu 22.04
   - **Instance type**: t3.micro (free tier)
   - **Key pair**: Create new, name: `foodshare-key` (save the `.pem` file somewhere safe!)
   - **VPC**: Default VPC
   - **Public IP**: Enable
4. Storage: 30 GB gp3 (fine for starting)
5. **Security group**: Create new
   - Name: `foodshare-server-sg`
   - Inbound rules:
     - HTTP (Port 80) from 0.0.0.0/0
     - HTTPS (Port 443) from 0.0.0.0/0
     - SSH (Port 22) from YOUR IP ONLY
6. Click "Launch instance" and wait 2-3 minutes

#### Step 4A.2: Connect to Your Server
1. Go to EC2 → Instances → Select your instance
2. Click "Connect"
3. Open SSH client and run the command shown (or use Windows Terminal, Mac Terminal, or PuTTY)

#### Step 4A.3: Install Node.js and Dependencies
Once connected via SSH:

```bash
# Update system
sudo yum update -y              # For Amazon Linux
# OR for Ubuntu:
# sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs      # Amazon Linux

# OR for Ubuntu:
# curl -fsSL https://deb.nodesource.com/setup_18.x | sudo bash -
# sudo apt install -y nodejs

# Install PM2 (to keep app running)
sudo npm install -g pm2
```

#### Step 4A.4: Deploy Your Code
```bash
# Navigate to app directory
cd /home/ec2-user/foodshare      # or /home/ubuntu for Ubuntu

# Clone from GitHub OR upload files
# Option 1: If using GitHub
git clone https://github.com/your-username/foodshare.git
cd foodshare

# Option 2: If uploading manually, use SCP or file transfer

# Install dependencies
npm install

# Create .env file with production values
nano .env
# Paste your database credentials, then Ctrl+X, Y, Enter

# Start app with PM2
pm2 start server.js --name foodshare
pm2 save              # Save PM2 config
pm2 startup           # Auto-start on server restart
```

#### Step 4A.5: Set Up Reverse Proxy (Nginx)
Your app runs on port 3001, but users should access via port 80/443.

```bash
# Install Nginx
sudo yum install -y nginx       # Amazon Linux
# OR: sudo apt install -y nginx  # Ubuntu

# Start Nginx
sudo systemctl start nginx
sudo systemctl enable nginx     # Auto-start on reboot

# Create Nginx config
sudo nano /etc/nginx/conf.d/foodshare.conf
```

Paste this config:

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Replace `your-domain.com` with your actual domain.

Reload Nginx:
```bash
sudo systemctl reload nginx
```

---

### ⭐ OPTION B: Using Elastic Beanstalk (Easier, Less Setup)

Elastic Beanstalk is AWS's platform-as-a-service that handles infrastructure for you.

#### Step 4B.1: Prepare Your Code
1. Create file `.ebextensions/nodejs.config`:

```yaml
option_settings:
  aws:autoscaling:asg:
    MinSize: 1
    MaxSize: 1
  aws:elasticbeanstalk:environment:proxy:staticfiles:
    /public: /public
  aws:elasticbeanstalk:cloudwatch:logs:
    StreamLogs: true
```

2. Create `.gitignore`:

```
node_modules/
.env
.DS_Store
```

#### Step 4B.2: Deploy with EB CLI
```bash
# Install EB CLI (on your local computer)
pip install awsebcli

# Initialize EB app
eb init -p node.js-18 foodshare --region ap-south-1

# Create environment
eb create foodshare-env --instance-type t3.micro

# Deploy
eb deploy

# View logs
eb logs
```

---

## PART 5: Set Up Domain Name (15 minutes)

### Step 5.1: Register or Link Domain
1. Go to AWS Route 53 → **Hosted zones**
2. Either:
   - **Register new domain**: Click "Register domain", search domain, complete purchase
   - **Use existing domain**: Click "Create hosted zone", add your domain
3. Route 53 will give you nameservers

### Step 5.2: Point Domain to Your Server
If you registered elsewhere (GoDaddy, Namecheap, etc.):
1. Go to your domain registrar
2. Update nameservers to AWS Route 53 nameservers (provided in hosted zone)
3. Wait 24-48 hours for DNS to propagate

### Step 5.3: Create DNS Record
1. Go to Route 53 → Hosted zones → Your domain
2. Click "Create record"
3. Set:
   - **Name**: (leave blank or www)
   - **Type**: A
   - **Value**: Your EC2 Elastic IP OR Elastic Beanstalk endpoint
   - Click "Create"

---

## PART 6: Set Up HTTPS/SSL Certificate (10 minutes)

### Step 6.1: Request SSL Certificate
1. Go to AWS Console → **ACM** (AWS Certificate Manager)
2. Click "Request certificate"
3. Choose "Request a public certificate"
4. Add domains:
   - `your-domain.com`
   - `www.your-domain.com`
5. Validation method: DNS validation (easier)
6. Click "Request"

### Step 6.2: Validate Certificate
1. AWS will ask you to add DNS records
2. Go back to Route 53 → Your hosted zone
3. Click "Create record" for each validation record AWS shows
4. AWS auto-validates (takes 5-15 minutes)

### Step 6.3: Update Nginx (if using EC2)
```bash
sudo nano /etc/nginx/conf.d/foodshare.conf
```

Update to:

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name your-domain.com www.your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Then:
```bash
sudo systemctl reload nginx
```

---

## PART 7: Monitor and Maintain (Ongoing)

### Step 7.1: Set Up CloudWatch Alerts
1. Go to AWS CloudWatch
2. Create alarm for:
   - High CPU usage
   - High memory usage
   - Database connection errors
3. Set email notifications

### Step 7.2: Enable Backups
**For RDS Database**:
1. Go to AWS RDS → Databases → Your database
2. Modify → Enable automated backups
3. Set retention: 7 days minimum

**For EC2 Instance**:
1. Click instance → Image and templates → Create image
2. Do this weekly or use AWS Backup service

### Step 7.3: Monitor Application Logs
```bash
# If using EC2 with PM2
pm2 logs foodshare

# View CloudWatch logs
# AWS Console → CloudWatch → Log Groups
```

---

## Checklist Before Going Live

- [ ] Database created and tested on RDS
- [ ] Application code updated with environment variables
- [ ] Server running (EC2 or Elastic Beanstalk)
- [ ] Domain registered and pointing to server
- [ ] SSL certificate installed
- [ ] Application accessible via HTTPS
- [ ] Database credentials are secure
- [ ] .env file NOT in Git repository
- [ ] Backups configured
- [ ] Security groups properly configured
- [ ] Monitoring and alerts set up

---

## Cost Estimation (AWS Free Tier first 12 months)

| Service | Free Tier | Estimated Cost |
|---------|-----------|----------------|
| EC2 t3.micro (or EB) | 750 hours/month | Free for 12 months |
| RDS db.t3.micro | 750 hours/month | Free for 12 months |
| Route 53 | First 1 domain | ~$0.50/month |
| ACM Certificate | Always free | Free |
| **TOTAL (Year 1)** | | **~Free** |
| **TOTAL (Year 2+)** | | **~$20-30/month** |

---

## Troubleshooting

### "Cannot connect to database"
- Check RDS security group inbound rules
- Verify database endpoint, username, password
- Ensure database is in "Available" state

### "Connection refused on port 3001"
- Check if Node.js is running: `pm2 list`
- Check logs: `pm2 logs foodshare`
- Ensure port 3001 is not blocked

### "Domain not resolving"
- Wait 24-48 hours after changing nameservers
- Check nameservers updated: `nslookup your-domain.com`
- Verify Route 53 A record created

### "SSL certificate error"
- Verify certificate requested for correct domain
- Check certificate is in "Issued" status
- Wait 15 minutes after creating DNS records

---

## Next Steps After Deployment

1. Test all features in production
2. Monitor application performance
3. Set up automated backups
4. Plan scaling strategy
5. Consider S3 for image storage (optional)
6. Set up email notifications for errors
7. Create disaster recovery plan

---

## Useful AWS Links

- AWS Console: https://console.aws.amazon.com
- RDS Documentation: https://docs.aws.amazon.com/rds/
- EC2 Documentation: https://docs.aws.amazon.com/ec2/
- Elastic Beanstalk: https://docs.aws.amazon.com/elasticbeanstalk/
- Route 53: https://docs.aws.amazon.com/route53/
- ACM: https://docs.aws.amazon.com/acm/

---

## Questions to Clarify (Decide Before Starting)

1. **Which deployment option?** EC2 (more control) or Elastic Beanstalk (easier)?
2. **Do you have a domain?** Register one before starting Part 5
3. **Will users upload large images?** Plan S3 integration separately
4. **Expected traffic?** Start with t3.micro, scale up as needed
5. **Team size?** Add IAM users for each team member

Good luck with your deployment! Start with Part 1 and work through systematically.
