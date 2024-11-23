import admin from "firebase-admin";
import serviceAccount from "./re-chatapp-2658d-firebase-adminsdk-y7g3f-177ea7126d.json";

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as any),
});

export default admin;
