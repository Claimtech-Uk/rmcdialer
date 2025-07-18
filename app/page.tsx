import { Button } from '@/modules/core/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/modules/core/components/ui/card'

export default function HomePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="max-w-md w-full space-y-8 p-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-center">Welcome to RMC Dialler</CardTitle>
            <CardDescription className="text-center">
              Professional dialler system for claims management
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                This application is for authorized agents only
              </p>
            </div>
            <div className="flex flex-col space-y-2">
              <Button asChild>
                <a href="/login">Sign In</a>
              </Button>
              <Button variant="outline" asChild>
                <a href="/dashboard">Dashboard</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 