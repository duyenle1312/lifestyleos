"use client";

// Port of SettingsView (Lifestyle_OSApp.swift)
import { useAuth } from "@/components/AuthProvider";
import { ButtonRow, LargeTitle, Row, Section, Toolbar } from "@/components/ui";

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  return (
    <>
      <Toolbar />
      <LargeTitle>Settings</LargeTitle>
      <Section header="Account" className="pt-2">
        {user?.email && <Row>Email: {user.email}</Row>}
      </Section>
      <Section>
        <ButtonRow destructive onPress={signOut}>
          Sign Out
        </ButtonRow>
      </Section>
    </>
  );
}
