import { useSettings } from "./settings-context"

// Timezone-aware date formatting hook
export function useFormatDate() {
  const { settings } = useSettings()
  
  return {
    // Format date with timezone
    formatDate: (date: Date | string, options?: Intl.DateTimeFormatOptions): string => {
      const timezone = settings?.timezone || "Africa/Kampala"
      const locale = settings?.locale || "en-GB"
      
      const dateObj = typeof date === 'string' ? new Date(date) : date
      
      try {
        return new Intl.DateTimeFormat(locale, {
          timeZone: timezone,
          ...options
        }).format(dateObj)
      } catch {
        // Fallback to default formatting
        return dateObj.toLocaleDateString(locale, options)
      }
    },
    
    // Format date and time with timezone
    formatDateTime: (date: Date | string, options?: Intl.DateTimeFormatOptions): string => {
      const timezone = settings?.timezone || "Africa/Kampala"
      const locale = settings?.locale || "en-GB"
      
      const dateObj = typeof date === 'string' ? new Date(date) : date
      
      try {
        return new Intl.DateTimeFormat(locale, {
          timeZone: timezone,
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          ...options
        }).format(dateObj)
      } catch {
        // Fallback to default formatting
        return dateObj.toLocaleString(locale, options)
      }
    },
    
    // Format time with timezone
    formatTime: (date: Date | string, options?: Intl.DateTimeFormatOptions): string => {
      const timezone = settings?.timezone || "Africa/Kampala"
      const locale = settings?.locale || "en-GB"
      
      const dateObj = typeof date === 'string' ? new Date(date) : date
      
      try {
        return new Intl.DateTimeFormat(locale, {
          timeZone: timezone,
          hour: '2-digit',
          minute: '2-digit',
          ...options
        }).format(dateObj)
      } catch {
        // Fallback to default formatting
        return dateObj.toLocaleTimeString(locale, options)
      }
    },
    
    // Get current time in user's timezone
    getCurrentTime: (): Date => {
      const timezone = settings?.timezone || "Africa/Kampala"
      
      try {
        // Create a date in the user's timezone
        const now = new Date()
        const utc = now.getTime() + (now.getTimezoneOffset() * 60000)
        
        // Get timezone offset for the user's timezone
        const targetTime = new Date(utc + (getTimezoneOffset(timezone) * 60000))
        return targetTime
      } catch {
        return new Date()
      }
    }
  }
}

// Helper function to get timezone offset
function getTimezoneOffset(timezone: string): number {
  const now = new Date()
  const utc = new Date(now.getTime() + (now.getTimezoneOffset() * 60000))
  
  try {
    const targetTime = new Date(utc.toLocaleString("en-US", { timeZone: timezone }))
    return (targetTime.getTime() - utc.getTime()) / 60000
  } catch {
    // Default to UTC+3 for Africa/Kampala
    return 180
  }
}

// Static utility functions for non-hook contexts
export function formatDateStatic(
  date: Date | string, 
  timezone: string = "Africa/Kampala", 
  locale: string = "en-GB",
  options?: Intl.DateTimeFormatOptions
): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  
  try {
    return new Intl.DateTimeFormat(locale, {
      timeZone: timezone,
      ...options
    }).format(dateObj)
  } catch {
    return dateObj.toLocaleDateString(locale, options)
  }
}

export function formatDateTimeStatic(
  date: Date | string, 
  timezone: string = "Africa/Kampala", 
  locale: string = "en-GB",
  options?: Intl.DateTimeFormatOptions
): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  
  try {
    return new Intl.DateTimeFormat(locale, {
      timeZone: timezone,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      ...options
    }).format(dateObj)
  } catch {
    return dateObj.toLocaleString(locale, options)
  }
}
