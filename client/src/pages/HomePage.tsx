import { Box, Typography, Paper, Button } from '@mui/material';
import { Link } from 'react-router-dom';

export default function HomePage() {
  return (
    <Box>
      <Typography variant="h2" component="h1" gutterBottom>
        Welcome to EasyTuner
      </Typography>

      <Paper sx={{ p: 4, mt: 4 }}>
        <Typography variant="h5" gutterBottom>
          ECU Map Recognition Platform
        </Typography>
        <Typography variant="body1" paragraph>
          EasyTuner is a browser-based analysis platform that enables automotive researchers,
          reverse engineers, and educational institutions to explore and understand ECU (Engine
          Control Unit) firmware structures through automated pattern recognition and
          visualization.
        </Typography>

        <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
          <Button variant="contained" color="primary" component={Link} to="/projects">
            Get Started
          </Button>
          <Button variant="outlined" color="primary" component={Link} to="/docs">
            Documentation
          </Button>
        </Box>
      </Paper>

      <Paper sx={{ p: 4, mt: 4, backgroundColor: '#fff3e0' }}>
        <Typography variant="h6" gutterBottom color="warning.dark">
          ⚠️ Important Legal Notice
        </Typography>
        <Typography variant="body2">
          This platform is designed for <strong>research and educational purposes only</strong>.
          <br />
          • ✅ Authorized research, education, and motorsport (off-road) applications
          <br />
          • ❌ NO modification of production vehicle ECUs without manufacturer authorization
          <br />• ❌ NO tampering with emissions systems
        </Typography>
      </Paper>
    </Box>
  );
}

