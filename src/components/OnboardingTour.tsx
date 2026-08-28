import { useEffect } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

export function OnboardingTour() {
  useEffect(() => {
    const hasSeenTour = localStorage.getItem('has_seen_tour');
    if (hasSeenTour) return;

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

    // small delay to let UI render
    const timer = setTimeout(() => {
      tour.drive();
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  return null;
}
