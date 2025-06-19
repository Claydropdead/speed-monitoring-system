# Password Management Features

This document describes the password management capabilities added to the Speed Test Monitoring System.

## 🕒 Auto-Logout Security Feature

### **Automatic Session Timeout**
The system now includes an automatic logout feature to enhance security:

#### Key Features:
- **15-minute session timeout**: Users are automatically logged out after 15 minutes of inactivity
- **14-minute warning**: Warning modal appears at 14 minutes with 1-minute countdown
- **Activity tracking**: Mouse movement, clicks, typing, and scrolling reset the timer
- **Session indicator**: Small timer in header shows remaining session time
- **User control**: Users can extend their session or logout immediately from the warning

#### How It Works:
1. **Activity Monitoring**: System tracks user interactions (mouse, keyboard, scroll, touch)
2. **Timer Reset**: Any activity resets the 15-minute countdown
3. **Warning Display**: At 14 minutes, a modal appears with countdown
4. **Auto-Logout**: If no action is taken, user is logged out at 15 minutes
5. **Session Extension**: Users can click "Stay Logged In" to reset the timer

#### Visual Indicators:
- **Header Timer**: Shows "Session: XXm" in the top navigation
- **Warning Modal**: Large countdown timer with action buttons
- **Countdown**: Live seconds countdown during the final minute

## Admin Password Management Powers