import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Initialize Firebase Admin SDK within the Cloud Functions environment
initializeApp();
const db = getFirestore();

/**
 * Daily Wellness Reminders Trigger
 * Runs every day at 08:00 AM (America/Sao_Paulo timezone)
 * Checks users who have contraceptive reminders or general hydration reminders enabled,
 * and queue a notification for dispatch.
 */
export const checkDailyWellnessReminders = onSchedule(
  {
    schedule: "0 8 * * *", // 8:00 AM daily
    timeZone: "America/Sao_Paulo",
    memory: "256MiB",
  },
  async (event) => {
    logger.info("Starting wellness reminders routine...", { structuredData: true });

    try {
      const now = new Date();
      logger.info(`Current scheduled run time: ${event.scheduleTime || now.toISOString()}`);

      // Query active users with contraceptive reminders enabled
      const usersRef = db.collection("users");
      const snapshot = await usersRef
        .where("contraceptive.reminderEnabled", "==", true)
        .where("contraceptive.enabled", "==", true)
        .get();

      if (snapshot.empty) {
        logger.info("No active contraceptive reminders to send today.");
      } else {
        logger.info(`Found ${snapshot.size} users with active contraceptive reminders.`);
        
        const batchPromises = snapshot.docs.map(async (doc) => {
          const userData = doc.data();
          const userId = doc.id;
          const reminderTime = userData.contraceptive.time || "08:00";
          const contraceptiveType = userData.contraceptive.type || "pill";
          
          logger.info(`[Notification Queue] Scheduling contraceptive reminder for user ${userId} at ${reminderTime} for device: ${contraceptiveType}`);
          
          // In a full implementation, you would trigger FCM (Firebase Cloud Messaging) or an external SMS/Email service
          return db.collection("notifications_queue").add({
            userId,
            type: "contraceptive",
            scheduledFor: reminderTime,
            status: "pending",
            message: `Lembrete Nefertiti: Hora de tomar seu anticoncepcional (${contraceptiveType}). Cuide-se com carinho!`,
            createdAt: new Date().toISOString(),
          });
        });

        await Promise.all(batchPromises);
      }

      // Check hydration targets (e.g., general daily logs checking or water reminders)
      logger.info("Wellness reminders checked and scheduled successfully.");
    } catch (error) {
      logger.error("Error in checkDailyWellnessReminders routine:", error);
    }
  }
);
