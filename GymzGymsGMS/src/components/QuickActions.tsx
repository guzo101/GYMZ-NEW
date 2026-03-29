import { useNavigate } from "react-router-dom";
import {
    UserPlus,
    DollarSign,
    ScanLine,
    Bell
} from "lucide-react";
import { Card } from "@/components/ui/card";

export const QuickActions = () => {
    const navigate = useNavigate();

    const actions = [
        {
            label: "Add Member",
            icon: UserPlus,
            color: "bg-primary/10 text-primary border-primary/20",
            path: "/members",
        },
        {
            label: "Log Payment",
            icon: DollarSign,
            color: "bg-primary/10 text-primary border-primary/20",
            path: "/finances",
        },
        {
            label: "Send Reminders",
            icon: Bell,
            color: "bg-primary/10 text-primary border-primary/20",
            path: "/admin/sent-notifications",
        },
        {
            label: "Quick Check-in",
            icon: ScanLine,
            color: "bg-primary/10 text-primary border-primary/20",
            path: "/admin/checkin",
        },
    ];

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-2">
            {actions.map((action, index) => (
                <Card
                    key={index}
                    className="group cursor-pointer hover:shadow-modern-lg transition-all duration-300 border-border/40 hover:border-primary/20 hover:-translate-y-1 glass-card p-4 overflow-hidden"
                    onClick={() => navigate(action.path)}
                >
                    <div className="flex flex-col items-center justify-center space-y-3 text-center">
                        <div
                            className={`w-12 h-12 rounded-full flex items-center justify-center border ${action.color} shadow-sm transition-transform group-hover:scale-110`}
                        >
                            <action.icon className="h-6 w-6" />
                        </div>
                        <span className="text-sm font-bold text-foreground/80 group-hover:text-primary transition-colors">
                            {action.label}
                        </span>
                    </div>
                </Card>
            ))}
        </div>
    );
};
