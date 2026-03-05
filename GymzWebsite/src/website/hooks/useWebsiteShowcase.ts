import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAllClasses, GymClass } from "@/admin/gym-calendar/api/classes";
import { getAllEvents, GymEvent } from "@/admin/gym-calendar/api/events";
import { getAllTrainers, Trainer } from "@/admin/gym-calendar/api/trainers";

interface ShowcaseResult {
  featuredClasses: GymClass[];
  upcomingEvents: GymEvent[];
  spotlightTrainers: Trainer[];
  isLoading: boolean;
  isError: boolean;
}

export function useWebsiteShowcase(): ShowcaseResult {
  const classesQuery = useQuery({
    queryKey: ["website-classes"],
    queryFn: getAllClasses,
    staleTime: 1000 * 60 * 10,
  });

  const eventsQuery = useQuery({
    queryKey: ["website-events"],
    queryFn: getAllEvents,
    staleTime: 1000 * 60 * 10,
  });

  const trainersQuery = useQuery({
    queryKey: ["website-trainers"],
    queryFn: getAllTrainers,
    staleTime: 1000 * 60 * 30,
  });

  const featuredClasses = useMemo(() => {
    return (classesQuery.data ?? []).slice(0, 3);
  }, [classesQuery.data]);

  const upcomingEvents = useMemo(() => {
    const today = new Date();
    return (eventsQuery.data ?? [])
      .filter((event) => new Date(event.event_date) >= today)
      .slice(0, 2);
  }, [eventsQuery.data]);

  const spotlightTrainers = useMemo(() => {
    return (trainersQuery.data ?? []).slice(0, 3);
  }, [trainersQuery.data]);

  return {
    featuredClasses,
    upcomingEvents,
    spotlightTrainers,
    isLoading: classesQuery.isLoading || eventsQuery.isLoading || trainersQuery.isLoading,
    isError: classesQuery.isError || eventsQuery.isError || trainersQuery.isError,
  };
}


