import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { supabase } from '@/integrations/supabase/client';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

export const app = initializeApp(firebaseConfig);

export const setupPushNotifications = async (userId: string) => {
  // Graceful fallback if Firebase is not configured in .env
  if (!firebaseConfig.projectId) {
    console.warn('Firebase push notifications skipped: Missing VITE_FIREBASE_PROJECT_ID in environment variables.');
    return;
  }

  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  
  try {
    const messaging = getMessaging(app);
    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
      const swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      const token = await getToken(messaging, { 
        vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
        serviceWorkerRegistration: swRegistration 
      });

      if (token) {
        // Save token to Supabase profiles
        await supabase
          .from('profiles')
          .update({ fcm_token: token })
          .eq('id', userId);
      }
      
      onMessage(messaging, (payload) => {
        // Here we could trigger a local toast notification
        console.log('Received foreground message: ', payload);
      });
    }
  } catch (error) {
    console.error('Push notification setup failed:', error);
  }
};
