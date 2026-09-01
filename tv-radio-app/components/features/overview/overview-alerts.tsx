"use client"

import { AlertBanner } from "@/components/shared/alert-banner"
import {
  dismissOnboardingBanner,
} from "@/components/ops/OperatorGuide"

type OverviewAlertsProps = {
  hasAlert: boolean
  error: unknown
  missingSrt: string[]
  onDismissAlert: () => void
  onboardingDismissed: boolean
  onDismissOnboarding: () => void
  healthCritical: boolean
  healthScore?: number
  healthDismissed: boolean
  onDismissHealth: () => void
}

export function OverviewAlerts({
  hasAlert,
  error,
  missingSrt,
  onDismissAlert,
  onboardingDismissed,
  onDismissOnboarding,
  healthCritical,
  healthScore,
  healthDismissed,
  onDismissHealth,
}: OverviewAlertsProps) {
  return (
    <div className="space-y-3">
      {hasAlert ? (
        <AlertBanner
          tone={error ? "danger" : "warn"}
          message={
            error
              ? "Serveur SRS injoignable — vérifier Docker SRS et le port 1985."
              : `Signal SRT absent : ${missingSrt.join(" · ")}. Vérifier la source encodeur.`
          }
          onDismiss={onDismissAlert}
          actionHref={error ? "/monitoring" : "/srt"}
          actionLabel={error ? "Ouvrir monitoring" : "Contrôle SRT"}
        />
      ) : null}

      {!onboardingDismissed ? (
        <AlertBanner
          tone="info"
          message="Première connexion ? Suivez le guide opérateur dans Configuration pour prendre en main la plateforme."
          onDismiss={() => {
            dismissOnboardingBanner()
            onDismissOnboarding()
          }}
          actionHref="/settings"
          actionLabel="Ouvrir le guide"
        />
      ) : null}

      {healthCritical && !healthDismissed ? (
        <AlertBanner
          tone="danger"
          message={`Santé système critique (${healthScore}%) — consulter le monitoring et le runbook incidents.`}
          onDismiss={onDismissHealth}
          actionHref="/incidents"
          actionLabel="Runbook incidents"
        />
      ) : null}
    </div>
  )
}
