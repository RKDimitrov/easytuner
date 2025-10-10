import { Outlet } from 'react-router-dom';
import { Box, Container, AppBar, Toolbar, Typography } from '@mui/material';

export default function Layout() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Header */}
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            EasyTuner
          </Typography>
        </Toolbar>
      </AppBar>

      {/* Main Content */}
      <Container
        component="main"
        maxWidth="xl"
        sx={{
          flexGrow: 1,
          py: 4,
        }}
      >
        <Outlet />
      </Container>

      {/* Footer */}
      <Box
        component="footer"
        sx={{
          py: 3,
          px: 2,
          mt: 'auto',
          backgroundColor: (theme) => theme.palette.grey[200],
        }}
      >
        <Container maxWidth="xl">
          <Typography variant="body2" color="text.secondary" align="center">
            EasyTuner - ECU Map Recognition Platform © {new Date().getFullYear()}
          </Typography>
        </Container>
      </Box>
    </Box>
  );
}

