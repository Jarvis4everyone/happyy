# Deploying to Render

This guide will help you deploy the Happy AI Call System to Render.

## Prerequisites

- A Render account (sign up at https://render.com)
- All required API keys (Twilio, Deepgram, OpenAI)
- A GitHub repository with your code (recommended)

## Deployment Steps

### Option 1: Deploy via Render Dashboard (Recommended)

1. **Push your code to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin <your-github-repo-url>
   git push -u origin main
   ```

2. **Create a New Web Service on Render**
   - Go to https://dashboard.render.com
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Select your repository

3. **Configure the Service**
   - **Name**: `happy-ai-call-system` (or your preferred name)
   - **Region**: Choose closest to your users (Oregon recommended for Twilio)
   - **Branch**: `main` (or your default branch)
   - **Root Directory**: Leave blank (root)
   - **Runtime**: `Docker`
   - **Build Command**: Leave blank (handled by Dockerfile)
   - **Start Command**: Leave blank (handled by Dockerfile)
   - **Health Check Path**: `/incoming`

4. **Set Environment Variables**
   Click "Advanced" → "Add Environment Variable" and add:

   ```
   NODE_ENV=production
   PORT=3000
   SERVER=your-service-name.onrender.com
   TWILIO_ACCOUNT_SID=your_twilio_account_sid
   TWILIO_AUTH_TOKEN=your_twilio_auth_token
   FROM_NUMBER=+1234567890
   DEEPGRAM_API_KEY=your_deepgram_api_key
   OPENAI_API_KEY=your_openai_api_key
   OPENAI_MODEL=gpt-4o-mini
   VOICE_MODEL=aura-asteria-en
   TTS_PROVIDER=deepgram
   RECORDING_ENABLED=false
   ```

   **Important**: After your first deploy, update `SERVER` to match your actual Render URL (without https://):
   - Example: If your URL is `https://happy-ai-call-system.onrender.com`
   - Set `SERVER=happy-ai-call-system.onrender.com`

5. **Select Plan**
   - Starter plan is sufficient for testing
   - Upgrade to Standard for production use

6. **Deploy**
   - Click "Create Web Service"
   - Render will build and deploy your application
   - Wait for deployment to complete (usually 5-10 minutes)

7. **Get Your Service URL**
   - Once deployed, you'll see your service URL
   - It will be: `https://your-service-name.onrender.com`
   - Update `SERVER` environment variable with your actual domain (without https://)

8. **Update Twilio Webhook**
   - Go to Twilio Console → Phone Numbers
   - Update your phone number's webhook URL to:
     ```
     https://your-service-name.onrender.com/incoming
     ```

### Option 2: Deploy via Render.yaml (Alternative)

1. Push your code to GitHub (including `render.yaml`)

2. In Render Dashboard:
   - Click "New +" → "Blueprint"
   - Connect your repository
   - Render will automatically detect `render.yaml`
   - Review and apply the configuration

3. Set environment variables in the Render dashboard (same as Option 1)

## Post-Deployment Steps

### 1. Update SERVER Environment Variable

After first deployment, you need to update the `SERVER` variable:

1. Go to Render Dashboard → Your Service → Environment
2. Update `SERVER` to your actual Render domain (without https://)
   - Example: `happy-ai-call-system.onrender.com`
3. Save and let the service restart

### 2. Configure Twilio Webhook

1. Go to [Twilio Console](https://console.twilio.com)
2. Navigate to Phone Numbers → Manage → Active Numbers
3. Click on your phone number
4. Under "Voice & Fax", set:
   - **A CALL COMES IN**: `https://your-service-name.onrender.com/incoming`
   - HTTP Method: `POST`
5. Save the configuration

### 3. Test Your Deployment

1. Visit `https://your-service-name.onrender.com`
2. Log in with:
   - Username: `admin`
   - Password: `harry`
3. Try making a test call
4. Check logs in the Render dashboard for any issues

## Important Notes

### Free Tier Limitations

- Render free tier services **spin down after 15 minutes of inactivity**
- First request after spin-down takes ~30-50 seconds (cold start)
- WebSocket connections may timeout after inactivity
- Consider upgrading to paid plan for production use

### Paid Plans

For production deployments, consider:
- **Starter Plan**: Better performance, always-on service
- **Standard Plan**: Auto-scaling, better performance
- Custom domain support
- Better WebSocket support

### Health Checks

Render automatically checks `/incoming` endpoint. Make sure it returns 200 OK.

### Environment Variables

Never commit `.env` file. Always use Render's Environment Variables section.

### Custom Domain

1. Go to your service → Settings → Custom Domains
2. Add your domain
3. Update DNS records as instructed
4. Update `SERVER` environment variable to your custom domain

## Troubleshooting

### Service Won't Start

- Check logs in Render dashboard
- Verify all environment variables are set
- Ensure PORT is set to 3000
- Check that Dockerfile builds successfully

### Calls Not Working

- Verify `SERVER` variable matches your Render domain (without https://)
- Check Twilio webhook is correctly configured
- Verify all API keys are correct
- Check Render service logs for errors

### WebSocket Issues

- Render free tier has WebSocket limitations
- Consider upgrading plan for better WebSocket support
- Check service logs for connection errors

### High Latency

- First request after spin-down will be slow (cold start)
- Upgrade to paid plan for always-on service
- Consider using a region closer to your users

## Monitoring

- **Logs**: View real-time logs in Render Dashboard → Logs
- **Metrics**: Monitor CPU, memory, and response times
- **Alerts**: Set up email alerts for service failures

## Updating Your Service

1. Push changes to GitHub
2. Render automatically deploys (if auto-deploy is enabled)
3. Or manually trigger deployment from Render dashboard

## Support

- Render Documentation: https://render.com/docs
- Render Support: support@render.com
- Check service logs for detailed error messages

---

**Note**: Remember to update the `SERVER` environment variable after deployment with your actual Render domain!

