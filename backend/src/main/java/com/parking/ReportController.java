
package com.parking;

import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
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

        // Currently occupied slots
        Set<String> occupied = new HashSet<>();

        vehicleRepository.findAll().forEach(vehicle ->
                occupied.add(vehicle.getSlotNumber())
        );

        int occupiedSlots = occupied.size();
        int availableSlots = totalSlots - occupiedSlots;

        // Current date and month
        LocalDate today = LocalDate.now();
        YearMonth currentMonth = YearMonth.now();

        // Get all successfully paid records
        var paidHistory = historyRepository.findAll()
                .stream()
                .filter(history ->
                        "Paid".equalsIgnoreCase(history.getPaymentStatus())
                        || "Confirmed".equalsIgnoreCase(history.getPaymentStatus())
                )
                .toList();

        // Today's completed exits
        var todayHistory = paidHistory.stream()
                .filter(history ->
                        history.getExitDate() != null
                        && history.getExitDate().toLocalDate().equals(today)
                )
                .toList();

        int todayVehicles = todayHistory.size();

        // Today's revenue
        BigDecimal dailyRevenue = todayHistory.stream()
                .map(history -> history.getFee() != null
                        ? history.getFee()
                        : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // This month's revenue, based on payment date
        BigDecimal monthlyRevenue = paidHistory.stream()
                .filter(history -> {
                    LocalDateTime paymentDate = history.getPaymentDate();

                    return paymentDate != null
                            && YearMonth.from(paymentDate).equals(currentMonth);
                })
                .map(history -> history.getFee() != null
                        ? history.getFee()
                        : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // Return report information
        return Map.of(
                "totalSlots", totalSlots,
                "occupiedSlots", occupiedSlots,
                "availableSlots", availableSlots,
                "todayVehicles", todayVehicles,
                "totalCollection", dailyRevenue,
                "dailyRevenue", dailyRevenue,
                "monthlyRevenue", monthlyRevenue
        );
    }
}
