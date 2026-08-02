(function () {
    const STORAGE_KEY = 'foodshare_notification_preferences';
    const DEFAULT_PREFERENCES = {
        near_me: true,
        pickup_reminders: true,
        delivery_updates: true,
        community_news: false,
        push_notifications: true,
        email_notifications: true,
        location_sharing: true
    };

    function getNotificationPreferences() {
        try {
            const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
            return { ...DEFAULT_PREFERENCES, ...parsed };
        } catch (error) {
            console.warn('Could not read notification preferences:', error);
            return { ...DEFAULT_PREFERENCES };
        }
    }

    function saveNotificationPreferences(prefs) {
        const normalized = { ...DEFAULT_PREFERENCES, ...prefs };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
        return normalized;
    }

    function setNotificationPreference(key, value) {
        const currentPrefs = getNotificationPreferences();
        currentPrefs[key] = value;
        return saveNotificationPreferences(currentPrefs);
    }

    function isNotificationEnabled(key) {
        const prefs = getNotificationPreferences();
        return prefs[key] !== false;
    }

    async function requestNotificationPermissionIfNeeded() {
        if (!('Notification' in window)) {
            return false;
        }

        if (Notification.permission === 'granted') {
            return true;
        }

        if (Notification.permission === 'denied') {
            return false;
        }

        const permission = await Notification.requestPermission();
        return permission === 'granted';
    }

    async function requestLocationPermissionIfNeeded() {
        if (!('geolocation' in navigator)) {
            return false;
        }

        try {
            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: false,
                    timeout: 8000
                });
            });

            localStorage.setItem('foodshare_user_location', JSON.stringify({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude
            }));
            return true;
        } catch (error) {
            console.warn('Location access was not granted:', error);
            return false;
        }
    }

    function notify(title, message, options = {}) {
        const preferenceKey = options.preferenceKey || 'delivery_updates';
        if (!isNotificationEnabled(preferenceKey)) {
            return null;
        }

        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, {
                body: message,
                tag: options.tag || 'foodshare-notification'
            });
        }

        return {
            title,
            message,
            type: options.type || 'info',
            preferenceKey,
            created_at: new Date().toISOString()
        };
    }

    function buildPreferenceNotifications(userRole, donations = []) {
        const prefs = getNotificationPreferences();
        const notifications = [];

        if (prefs.near_me && userRole === 'recipient' && donations.some((donation) => donation.status === 'available')) {
            notifications.push({
                type: 'info',
                title: '📍 New Donations Nearby',
                message: 'New nearby food donations are ready for you to request.',
                created_at: new Date().toISOString(),
                preferenceKey: 'near_me'
            });
        }

        if (prefs.pickup_reminders && ['donor', 'recipient', 'volunteer'].includes(userRole)) {
            const reminderCount = donations.filter((donation) => ['requested', 'in-transit', 'available'].includes(donation.status)).length;
            if (reminderCount > 0) {
                notifications.push({
                    type: 'warning',
                    title: '🕒 Pickup Reminder',
                    message: `You have ${reminderCount} pickup-related update${reminderCount > 1 ? 's' : ''} to review.`,
                    created_at: new Date().toISOString(),
                    preferenceKey: 'pickup_reminders'
                });
            }
        }

        if (prefs.delivery_updates && ['donor', 'recipient', 'volunteer'].includes(userRole)) {
            const deliveryCount = donations.filter((donation) => ['requested', 'in-transit', 'completed'].includes(donation.status)).length;
            if (deliveryCount > 0) {
                notifications.push({
                    type: 'success',
                    title: '🚚 Delivery Update',
                    message: `${deliveryCount} donation${deliveryCount > 1 ? 's' : ''} have delivery progress to share.`,
                    created_at: new Date().toISOString(),
                    preferenceKey: 'delivery_updates'
                });
            }
        }

        if (prefs.community_news) {
            notifications.push({
                type: 'info',
                title: '📣 Community News',
                message: 'Community updates and important announcements will arrive here and on your device.',
                created_at: new Date().toISOString(),
                preferenceKey: 'community_news'
            });
        }

        if (prefs.email_notifications) {
            notifications.push({
                type: 'info',
                title: '✉️ Email Updates',
                message: 'Email updates are enabled for your account activity.',
                created_at: new Date().toISOString(),
                preferenceKey: 'email_notifications'
            });
        }

        if (prefs.location_sharing) {
            const savedLocation = localStorage.getItem('foodshare_user_location');
            if (savedLocation) {
                notifications.push({
                    type: 'info',
                    title: '📍 Location Sharing',
                    message: 'Your location is currently available for better nearby recommendations.',
                    created_at: new Date().toISOString(),
                    preferenceKey: 'location_sharing'
                });
            }
        }

        return notifications;
    }

    window.foodshareNotificationPrefs = {
        get: getNotificationPreferences,
        save: saveNotificationPreferences,
        set: setNotificationPreference,
        enabled: isNotificationEnabled,
        requestPermission: requestNotificationPermissionIfNeeded,
        requestLocation: requestLocationPermissionIfNeeded,
        notify,
        buildPreferenceNotifications
    };
})();
