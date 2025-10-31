# Deployment Checklist for Render

## Pre-Deployment Checklist

- [ ] All code committed and pushed to GitHub
- [ ] All environment variables documented
- [ ] Dockerfile tested locally (optional)
- [ ] README updated with deployment info

## Environment Variables Required

Set these in Render Dashboard → Environment Variables:

### Required Variables:
- [ ] `NODE_ENV=production`
- [ ] `PORT=3000`
- [ ] `SERVER` - Your Render service URL (without https://), e.g., `happy-ai-call-system.onrender.com`
- [ ] `TWILIO_ACCOUNT_SID` - Your Twilio account SID
- [ ] `TWILIO_AUTH_TOKEN` - Your Twilio auth token
- [ ] `FROM_NUMBER` - Your Twilio phone number (format: +1234567890)
- [ ] `DEEPGRAM_API_KEY` - Your Deepgram API key
- [ ] `OPENAI_API_KEY` - Your OpenAI API key

### Optional Variables:
- [ ] `OPENAI_MODEL` - Default: `gpt-4o-mini`
- [ ] `VOICE_MODEL` - Default: `aura-asteria-en`
- [ ] `TTS_PROVIDER` - Default: `deepgram` (or `cartesia`)
- [ ] `CARTESIA_API_KEY` - If using Cartesia TTS
- [ ] `CARTESIA_VOICE_ID` - If using Cartesia TTS
- [ ] `RECORDING_ENABLED` - Set to `true` to enable call recording

## Deployment Steps

### Step 1: Prepare Repository
- [ ] Push code to GitHub
- [ ] Verify all files are committed (Dockerfile, render.yaml, etc.)

### Step 2: Create Render Service
- [ ] Go to https://dashboard.render.com
- [ ] Click "New +" → "Web Service"
- [ ] Connect GitHub account (if not already connected)
- [ ] Select your repository
- [ ] Choose branch (usually `main` or `master`)

### Step 3: Configure Service
- [ ] **Name**: Choose a unique name (e.g., `happy-ai-call-system`)
- [ ] **Region**: Select closest region (Oregon recommended)
- [ ] **Runtime**: Select `Docker`
- [ ] **Health Check Path**: `/incoming`
- [ ] **Plan**: Choose Starter (free) or Standard (paid)

### Step 4: Set Environment Variables
- [ ] Add all required environment variables (see list above)
- [ ] **Important**: Initially set `SERVER` to placeholder, you'll update it after first deploy

### Step 5: Deploy
- [ ] Click "Create Web Service"
- [ ] Wait for build to complete (5-10 minutes)
- [ ] Note your service URL (e.g., `https://happy-ai-call-system.onrender.com`)

### Step 6: Update SERVER Variable
- [ ] After deployment completes, copy your service URL
- [ ] Remove `https://` from the URL
- [ ] Go to Environment Variables
- [ ] Update `SERVER` to your actual domain (e.g., `happy-ai-call-system.onrender.com`)
- [ ] Save changes (service will restart automatically)

### Step 7: Configure Twilio
- [ ] Go to Twilio Console → Phone Numbers
- [ ] Click on your phone number
- [ ] Under "Voice & Fax" → "A CALL COMES IN"
- [ ] Set webhook URL: `https://your-service-name.onrender.com/incoming`
- [ ] HTTP Method: `POST`
- [ ] Save configuration

### Step 8: Test Deployment
- [ ] Visit your service URL in browser
- [ ] Verify login page loads
- [ ] Log in with admin/harry
- [ ] Test making a call
- [ ] Check logs in Render dashboard
- [ ] Verify live logs are streaming in web dashboard

## Post-Deployment

### Verify Everything Works:
- [ ] Web dashboard loads correctly
- [ ] Can log in successfully
- [ ] Can initiate a call
- [ ] Live logs are displayed
- [ ] Can stop a call
- [ ] Can make a new call
- [ ] AI responds correctly
- [ ] Audio quality is good

### Monitor:
- [ ] Check Render logs for errors
- [ ] Monitor service uptime
- [ ] Check API usage/quotas
- [ ] Monitor response times

## Troubleshooting

If something doesn't work:

1. **Check Render Logs**
   - Go to Render Dashboard → Your Service → Logs
   - Look for error messages

2. **Verify Environment Variables**
   - All required variables are set
   - No typos in variable names
   - Values are correct (especially API keys)

3. **Check Twilio Configuration**
   - Webhook URL is correct
   - HTTP method is POST
   - Phone number is active

4. **Verify SERVER Variable**
   - Matches your Render URL exactly (without https://)
   - No trailing slashes

5. **Test Health Check**
   - Visit: `https://your-service-name.onrender.com/incoming`
   - Should return XML (TwiML response)

## Important Notes

⚠️ **Free Tier Limitations:**
- Services spin down after 15 minutes of inactivity
- Cold starts take 30-50 seconds
- WebSocket connections may timeout
- Consider upgrading for production use

✅ **Production Recommendations:**
- Use Standard plan or higher
- Set up custom domain
- Enable monitoring and alerts
- Regular backups of configurations

---

**Remember**: Update the `SERVER` environment variable after first deployment with your actual Render domain!

