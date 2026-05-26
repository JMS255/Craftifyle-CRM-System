export default function PrivacyPolicy() {
  return (
    <div className="max-w-2xl mx-auto p-8 text-gray-800">
      <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
      <p className="text-gray-500 text-sm mb-8">Last updated: May 26, 2026</p>

      <section className="mb-6">
        <h2 className="text-lg font-semibold mb-2">1. About This Policy</h2>
        <p className="text-sm text-gray-600 leading-relaxed">
          This Privacy Policy explains how Craftifyle ("we", "us", or "our"), owned and operated by James Ignacio, collects, uses, and protects information when you interact with our automated messaging assistant (Crafty AI) on Facebook Messenger.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-lg font-semibold mb-2">2. Information We Collect</h2>
        <p className="text-sm text-gray-600 leading-relaxed mb-2">
          When you message our Facebook Page, we may collect:
        </p>
        <ul className="text-sm text-gray-600 leading-relaxed list-disc pl-5 space-y-1">
          <li>Your name and Facebook profile information as shared by Messenger</li>
          <li>Messages you send to our page</li>
          <li>Event details you provide (event type, date, venue, guest count)</li>
          <li>Contact information you voluntarily share (email, phone number)</li>
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="text-lg font-semibold mb-2">3. How We Use Your Information</h2>
        <p className="text-sm text-gray-600 leading-relaxed mb-2">
          We use the information collected to:
        </p>
        <ul className="text-sm text-gray-600 leading-relaxed list-disc pl-5 space-y-1">
          <li>Respond to your inquiries about our photobooth and photography services</li>
          <li>Recommend packages suitable for your event</li>
          <li>Process and confirm bookings</li>
          <li>Send you relevant information about your booking</li>
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="text-lg font-semibold mb-2">4. Automated Messaging</h2>
        <p className="text-sm text-gray-600 leading-relaxed">
          Our Facebook Page uses Crafty AI, an automated messaging assistant powered by artificial intelligence, to respond to initial inquiries. Crafty AI may store conversation history to provide context-aware responses. Conversations may be reviewed by James Ignacio to ensure quality and follow up on bookings.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-lg font-semibold mb-2">5. Data Storage</h2>
        <p className="text-sm text-gray-600 leading-relaxed">
          Conversation data is stored securely in our database (Supabase) hosted on secure cloud infrastructure. We retain conversation history to provide continuity in our service. You may request deletion of your conversation data at any time by contacting us directly.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-lg font-semibold mb-2">6. Data Sharing</h2>
        <p className="text-sm text-gray-600 leading-relaxed">
          We do not sell, trade, or share your personal information with third parties except as necessary to operate our service (e.g., AI processing via Groq). We do not use your information for advertising purposes.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-lg font-semibold mb-2">7. Your Rights</h2>
        <p className="text-sm text-gray-600 leading-relaxed">
          You have the right to request access to, correction of, or deletion of your personal data. To exercise these rights, please contact us at the details below.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-lg font-semibold mb-2">8. Contact Us</h2>
        <p className="text-sm text-gray-600 leading-relaxed">
          If you have any questions about this Privacy Policy, please contact us:
        </p>
        <div className="mt-2 text-sm text-gray-600 space-y-1">
          <p><span className="font-medium">Business:</span> Craftifyle</p>
          <p><span className="font-medium">Owner:</span> James Ignacio</p>
          <p><span className="font-medium">Location:</span> Zamboanga City, Philippines</p>
          <p><span className="font-medium">Facebook:</span> facebook.com/craftifylePH</p>
        </div>
      </section>

      <div className="mt-10 pt-6 border-t border-gray-200 text-xs text-gray-400">
        © 2026 Craftifyle. All rights reserved.
      </div>
    </div>
  )
}
