"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { apiFetch } from "@/lib/api-fetch"
import type { SRTStream, RTMPStream, IcecastSource } from "@/types/streams"

interface StreamFormProps {
  protocol: 'srt' | 'rtmp' | 'icecast'
  stream?: SRTStream | RTMPStream | IcecastSource | null
  onClose: () => void
}

export function StreamForm({ protocol, stream, onClose }: StreamFormProps) {
  const queryClient = useQueryClient()
  const [formData, setFormData] = useState<any>({
    name: '',
    ...(protocol === 'srt' && {
      mode: 'listener' as const,
      host: '0.0.0.0',
      port: 6000,
      streamId: '',
      passphrase: '',
      latency: 2000,
      encryption: false,
    }),
    ...(protocol === 'rtmp' && {
      serverUrl: 'rtmp://localhost:1935',
      streamKey: '',
      application: 'live',
    }),
    ...(protocol === 'icecast' && {
      mountpoint: '/stream',
      serverUrl: 'http://localhost:8000',
      username: 'source',
      password: '',
      genre: '',
      description: '',
      bitrate: 128,
    }),
  })

  useEffect(() => {
    if (stream) {
      setFormData({
        name: stream.name,
        ...(protocol === 'srt' && {
          mode: (stream as SRTStream).mode,
          host: (stream as SRTStream).host,
          port: (stream as SRTStream).port,
          streamId: (stream as SRTStream).streamId || '',
          passphrase: (stream as SRTStream).passphrase || '',
          latency: (stream as SRTStream).latency,
          encryption: (stream as SRTStream).encryption,
        }),
        ...(protocol === 'rtmp' && {
          serverUrl: (stream as RTMPStream).serverUrl,
          streamKey: (stream as RTMPStream).streamKey,
          application: (stream as RTMPStream).application,
        }),
        ...(protocol === 'icecast' && {
          mountpoint: (stream as IcecastSource).mountpoint,
          serverUrl: (stream as IcecastSource).serverUrl,
          username: (stream as IcecastSource).username,
          password: (stream as IcecastSource).password,
          genre: (stream as IcecastSource).genre || '',
          description: (stream as IcecastSource).description || '',
          bitrate: (stream as IcecastSource).bitrate,
        }),
      })
    }
  }, [stream, protocol])

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiFetch('/api/streams/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!response.ok) throw new Error('Failed to create stream')
      return await response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['streams'] })
      toast.success('Stream created successfully')
      onClose()
    },
    onError: () => {
      toast.error('Failed to create stream')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    const streamData = {
      name: formData.name,
      type: protocol,
      ...(protocol === 'srt' && {
        inputPort: formData.port,
        outputPort: formData.port + 1,
      }),
      ...(protocol === 'rtmp' && {
        inputPort: parseInt(formData.serverUrl.split(':')[2]?.split('/')[0] || '1935'),
        streamKey: formData.streamKey,
      }),
      ...(protocol === 'icecast' && {
        inputPort: parseInt(formData.serverUrl.split(':')[2] || '8000'),
      }),
    }

    createMutation.mutate(streamData)
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {stream ? 'Edit' : 'Create'} {protocol.toUpperCase()} Stream
          </DialogTitle>
          <DialogDescription>
            Configure your {protocol.toUpperCase()} stream settings
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          {protocol === 'srt' && (
            <>
              <div>
                <Label>Mode</Label>
                <Select
                  value={formData.mode}
                  onValueChange={(value: any) => setFormData({ ...formData, mode: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="caller">Caller</SelectItem>
                    <SelectItem value="listener">Listener</SelectItem>
                    <SelectItem value="rendezvous">Rendezvous</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Host</Label>
                  <Input
                    value={formData.host}
                    onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>Port</Label>
                  <Input
                    type="number"
                    value={formData.port}
                    onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) })}
                    required
                  />
                </div>
              </div>
              <div>
                <Label>Latency (ms)</Label>
                <Input
                  type="number"
                  value={formData.latency}
                  onChange={(e) => setFormData({ ...formData, latency: parseInt(e.target.value) })}
                  required
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.encryption}
                  onCheckedChange={(checked) => setFormData({ ...formData, encryption: checked })}
                />
                <Label>Encryption</Label>
              </div>
            </>
          )}

          {protocol === 'rtmp' && (
            <>
              <div>
                <Label>Server URL</Label>
                <Input
                  value={formData.serverUrl}
                  onChange={(e) => setFormData({ ...formData, serverUrl: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>Stream Key</Label>
                <Input
                  value={formData.streamKey}
                  onChange={(e) => setFormData({ ...formData, streamKey: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>Application</Label>
                <Input
                  value={formData.application}
                  onChange={(e) => setFormData({ ...formData, application: e.target.value })}
                  required
                />
              </div>
            </>
          )}

          {protocol === 'icecast' && (
            <>
              <div>
                <Label>Mountpoint</Label>
                <Input
                  value={formData.mountpoint}
                  onChange={(e) => setFormData({ ...formData, mountpoint: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>Server URL</Label>
                <Input
                  value={formData.serverUrl}
                  onChange={(e) => setFormData({ ...formData, serverUrl: e.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Username</Label>
                  <Input
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>Password</Label>
                  <Input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div>
                <Label>Bitrate (kbps)</Label>
                <Input
                  type="number"
                  value={formData.bitrate}
                  onChange={(e) => setFormData({ ...formData, bitrate: parseInt(e.target.value) })}
                  required
                />
              </div>
            </>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : stream ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

