/**
 * Console Panel Component
 * Displays browser console errors, warnings, and logs for debugging
 * Retractable with collapse/expand button
 */

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertCircle, AlertTriangle, Info, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ConsoleMessage {
  type: 'log' | 'error' | 'warn' | 'info';
  message: string;
  timestamp: string;
}

export default function ConsolePanel() {
  const [messages, setMessages] = useState<ConsoleMessage[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    // Capture console.error
    const originalError = console.error;
    console.error = (...args) => {
      originalError(...args);
      const message = args.map((arg) => {
        if (typeof arg === 'object') {
          return JSON.stringify(arg, null, 2);
        }
        return String(arg);
      }).join(' ');
      
      setMessages((prev) => [
        ...prev,
        {
          type: 'error',
          message,
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    };

    // Capture console.warn
    const originalWarn = console.warn;
    console.warn = (...args) => {
      originalWarn(...args);
      const message = args.map((arg) => {
        if (typeof arg === 'object') {
          return JSON.stringify(arg, null, 2);
        }
        return String(arg);
      }).join(' ');
      
      setMessages((prev) => [
        ...prev,
        {
          type: 'warn',
          message,
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    };

    // Capture console.log
    const originalLog = console.log;
    console.log = (...args) => {
      originalLog(...args);
      const message = args.map((arg) => {
        if (typeof arg === 'object') {
          return JSON.stringify(arg, null, 2);
        }
        return String(arg);
      }).join(' ');
      
      setMessages((prev) => [
        ...prev,
        {
          type: 'log',
          message,
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    };

    // Capture global errors
    const handleError = (event: ErrorEvent) => {
      setMessages((prev) => [
        ...prev,
        {
          type: 'error',
          message: `${event.message} at ${event.filename}:${event.lineno}:${event.colno}`,
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    };

    window.addEventListener('error', handleError);

    return () => {
      console.error = originalError;
      console.warn = originalWarn;
      console.log = originalLog;
      window.removeEventListener('error', handleError);
    };
  }, []);

  const getIcon = (type: string) => {
    switch (type) {
      case 'error':
        return <AlertCircle className="w-3 h-3 text-destructive flex-shrink-0" />;
      case 'warn':
        return <AlertTriangle className="w-3 h-3 text-amber-400 flex-shrink-0" />;
      case 'log':
      case 'info':
      default:
        return <Info className="w-3 h-3 text-primary flex-shrink-0" />;
    }
  };

  const getTextColor = (type: string) => {
    switch (type) {
      case 'error':
        return 'text-destructive';
      case 'warn':
        return 'text-amber-400';
      case 'log':
      case 'info':
      default:
        return 'text-muted-foreground';
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      <Card className="rounded-none border-t border-border/50 bg-card/95 backdrop-blur">
        <CardHeader 
          className="pb-2 cursor-pointer hover:bg-background/30 transition-colors select-none" 
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs lg:text-sm font-display flex items-center gap-2">
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-primary flex-shrink-0" />
              ) : (
                <ChevronUp className="w-4 h-4 text-primary flex-shrink-0" />
              )}
              Console ({messages.length})
            </CardTitle>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setMessages([]);
                }}
                title="Clear console"
                className="h-7 w-7 p-0"
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </CardHeader>

        {isExpanded && (
          <CardContent className="pb-2 border-t border-border/30">
            <ScrollArea className="h-32 lg:h-40 w-full border border-border/20 rounded bg-background/50 p-2">
              <div className="space-y-0.5 font-mono text-xs">
                {messages.length === 0 ? (
                  <p className="text-muted-foreground text-xs">No console messages</p>
                ) : (
                  messages.map((msg, idx) => (
                    <div key={idx} className="flex gap-2 text-foreground/80 hover:bg-background/50 p-1 rounded transition-colors">
                      <span className="text-muted-foreground flex-shrink-0 min-w-fit text-xs">
                        [{msg.timestamp}]
                      </span>
                      <div className="flex gap-1.5 flex-1 min-w-0">
                        {getIcon(msg.type)}
                        <span className={`${getTextColor(msg.type)} break-words text-xs`}>
                          {msg.message}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
