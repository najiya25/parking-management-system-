package com.parking;

import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api")
public class ReportController {

    private final VehicleRepository vehicleRepository;
    private final ParkingHistoryRepository historyRepository;

    public ReportController(
            VehicleRepository vehicleRepository,
            ParkingHistoryRepository historyRepository) {

        this.vehicleRepository = vehicleRepository;
        this.historyRepository = historyRepository;
    }

    @GetMapping("/report")
    public Map<String, Object> getReport() {

        // Total parking slots
        int totalSlots = 8;

        // Find currently occupied slots
        Set<String> occupied = new HashSet<>();

        vehicleRepository.findAll().forEach(vehicle ->
                occupied.add(vehicle.getSlotNumber())
        );

        int occupiedSlots = occupied.size();

        int availableSlots = totalSlots - occupiedSlots;

        // Calculate today's vehicles and collection
        LocalDate today = LocalDate.now();

        var todayHistory = historyRepository.findAll()
                .stream()
                .filter(history ->
                        history.getExitDate().toLocalDate().equals(today)
                )
                .toList();

        int todayVehicles = todayHistory.size();

        BigDecimal totalCollection = todayHistory.stream()
                .map(ParkingHistory::getFee)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // Return dashboard information
        return Map.of(
                "totalSlots", totalSlots,
                "occupiedSlots", occupiedSlots,
                "availableSlots", availableSlots,
                "todayVehicles", todayVehicles,
                "totalCollection", totalCollection
        );
    }
}