import * as React from "react";
import { format, parse, setHours, setMinutes } from "date-fns";
import { Calendar as CalendarIcon, Clock } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";

interface DateTimePickerProps {
    value: string | undefined; // ISO string or empty
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
}

export function DateTimePicker({
    value,
    onChange,
    placeholder = "Select date & time",
    className,
}: DateTimePickerProps) {
    const [date, setDate] = React.useState<Date | undefined>(
        value ? new Date(value) : undefined
    );
    const [time, setTime] = React.useState<string>(
        value ? format(new Date(value), "HH:mm") : "12:00"
    );

    React.useEffect(() => {
        if (value) {
            const d = new Date(value);
            if (!isNaN(d.getTime())) {
                setDate(d);
                setTime(format(d, "HH:mm"));
            }
        }
    }, [value]);

    const handleDateSelect = (selectedDate: Date | undefined) => {
        if (!selectedDate) return;

        // Maintain the current time when changing the date
        const [hours, minutes] = time.split(":").map(Number);
        const newDateTime = setHours(setMinutes(selectedDate, minutes), hours);

        setDate(newDateTime);
        onChange(newDateTime.toISOString());
    };

    const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newTime = e.target.value;
        setTime(newTime);

        if (date) {
            const [hours, minutes] = newTime.split(":").map(Number);
            const newDateTime = setHours(setMinutes(date, minutes), hours);
            onChange(newDateTime.toISOString());
        }
    };

    return (
        <div className={cn("grid gap-2", className)}>
            <Popover>
                <PopoverTrigger asChild>
                    <Button
                        variant={"outline"}
                        className={cn(
                            "w-full justify-start text-left font-normal h-12 bg-[#141A14] border-sidebar-border/40 rounded-xl px-4",
                            !date && "text-muted-foreground"
                        )}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                        {date ? (
                            <span className="text-white font-bold">
                                {format(date, "PPP")} at {time}
                            </span>
                        ) : (
                            <span>{placeholder}</span>
                        )}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-[#0A0F0A] border-sidebar-border/40" align="start">
                    <Calendar
                        mode="single"
                        selected={date}
                        onSelect={handleDateSelect}
                        initialFocus
                        className="rounded-t-xl"
                    />
                    <div className="p-3 border-t border-sidebar-border/40 flex items-center gap-3">
                        <Clock className="w-4 h-4 text-primary" />
                        <Input
                            type="time"
                            value={time}
                            onChange={handleTimeChange}
                            className="h-9 bg-[#141A14] border-sidebar-border/40 rounded-lg text-white font-bold focus:border-primary/50 [color-scheme:dark]"
                        />
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    );
}
