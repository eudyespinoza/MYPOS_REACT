# MYPOS_REACT

A Point of Sale (POS) system built with React frontend and Python backend.

## Setup

### Environment Variables

1. Copy the example environment file:
   ```bash
   cp app/src/.env.example app/src/.env
   ```

2. Fill in the actual values in the `.env` file:
   - `SECRET_KEY`: Flask secret key for sessions and CSRF protection
   - `PASSWORD_FABRIC`: Password for Fabric database connection
   - `USERNAME_FABRIC`: Username for Fabric database connection
   - `PASSWORD_DB`: Database password
   - `EMAIL_PASSWORD`: Password for email service
   - `GRAPH_CLIENT_SECRET`: Azure Graph API client secret
   - `D365_CLIENT_SECRET_QA`: Dynamics 365 QA environment client secret
   - `D365_CLIENT_SECRET_PROD`: Dynamics 365 production environment client secret

### Configuration

The application uses a `config.ini` file that references environment variables. Make sure to create your `.env` file with the appropriate values before running the application.

## Project Structure

- `app/`: Backend Python application
- `frontend/`: React frontend application
- `logs/`: Application logs
- `traefik/`: Reverse proxy configuration

## Docker Setup

The project includes Docker configuration files for easy deployment.

## Security

⚠️ **Important**: Never commit sensitive credentials to version control. Use environment variables for all secrets and API keys.