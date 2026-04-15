import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ListTodo,
  BrainCircuit,
  Bot,
  FolderOpen,
  Calendar,
  Settings
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { useQuickCaptureStore } from '@/stores/quickCaptureStore';

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { open: openQuickCapture } = useQuickCaptureStore();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const runCommand = (command: () => void) => {
    setOpen(false);
    command();
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        
        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => runCommand(() => openQuickCapture('task'))}>
            <ListTodo className="mr-2 h-4 w-4" />
            <span>New Task</span>
            <CommandShortcut>⌘T</CommandShortcut>
          </CommandItem>
          
          <CommandItem onSelect={() => runCommand(() => navigate('/conhecimento'))}>
            <BrainCircuit className="mr-2 h-4 w-4" />
            <span>Search Memory</span>
            <CommandShortcut>⌘M</CommandShortcut>
          </CommandItem>
          
          <CommandItem onSelect={() => runCommand(() => navigate('/chat'))}>
            <Bot className="mr-2 h-4 w-4" />
            <span>Run Agent</span>
            <CommandShortcut>⌘R</CommandShortcut>
          </CommandItem>
        </CommandGroup>
        
        <CommandSeparator />
        
        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => runCommand(() => navigate('/projetos'))}>
            <FolderOpen className="mr-2 h-4 w-4" />
            <span>Projects</span>
          </CommandItem>
          
          <CommandItem onSelect={() => runCommand(() => navigate('/agenda'))}>
            <Calendar className="mr-2 h-4 w-4" />
            <span>Agenda</span>
          </CommandItem>

          <CommandItem onSelect={() => runCommand(() => navigate('/aprendizado'))}>
            <BrainCircuit className="mr-2 h-4 w-4" />
            <span>Intelligence Dashboard</span>
          </CommandItem>
          
          <CommandItem onSelect={() => runCommand(() => navigate('/settings'))}>
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
