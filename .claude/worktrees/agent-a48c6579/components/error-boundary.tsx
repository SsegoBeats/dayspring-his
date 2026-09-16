"use client"

import React from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle } from "lucide-react"

interface Props {
  children: React.ReactNode
  fallbackTitle?: string
  fallbackDescription?: string
  onRetry?: () => void
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, errorInfo)
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              {this.props.fallbackTitle ?? "Something went wrong"}
            </CardTitle>
            <CardDescription>
              {this.props.fallbackDescription ??
                "An error occurred while loading this section. You can try again or refresh the page."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {process.env.NODE_ENV === "development" && (
              <pre className="rounded bg-muted p-2 text-xs overflow-auto max-h-24">
                {this.state.error.message}
              </pre>
            )}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => this.setState({ hasError: false, error: null })}
              >
                Try again
              </Button>
              {this.props.onRetry && (
                <Button onClick={this.props.onRetry}>Retry</Button>
              )}
              <Button variant="ghost" onClick={() => window.location.reload()}>
                Refresh page
              </Button>
            </div>
          </CardContent>
        </Card>
      )
    }
    return this.props.children
  }
}
