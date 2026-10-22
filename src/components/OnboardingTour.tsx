import { useEffect } from 'react';
import { useLocation } from '@tanstack/react-router';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

export function OnboardingTour() {
  const location = useLocation();

  useEffect(() => {
    // Only run tour in client browser and on the main marketplace pages, not on /auth
    if (typeof window === 'undefined') return;
    if (location.pathname.startsWith('/auth')) return;

    const hasSeenTour = localStorage.getItem('has_seen_tour');
    if (hasSeenTour) return;

    // Verify elements exist before driving
    const browseEl = document.querySelector('#tour-browse');
    if (!browseEl) return;

    const tour = driver({
      showProgress: true,
      steps: [
        {
          element: '#tour-browse',
          popover: {
            title: 'Browse Thrift',
            description: 'Discover unique and affordable thrift items curated just for you.',
            side: "top",
            align: 'start'
          }
        },
        {
          element: '#tour-sell',
          popover: {
            title: 'Sell Your Items',
            description: 'Declutter your closet! Click here to easily upload and sell your clothes.',
            side: "top",
            align: 'start'
          }
        },
        {
          element: '#tour-auth',
          popover: {
            title: 'Your Account & Wallet',
            description: 'Manage your profile, view orders, and withdraw your funds securely.',
            side: "top",
            align: 'end'
          }
        }
      ],
      onDestroyStarted: () => {
        localStorage.setItem('has_seen_tour', 'true');
        tour.destroy();
      },
    });

    const timer = setTimeout(() => {
      // Re-check target exists
      if (document.querySelector('#tour-browse')) {
        tour.drive();
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [location.pathname]);

  return null;
}
