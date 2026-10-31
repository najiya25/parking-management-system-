
package com.parking;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class ExitControllerTest {

    @Test
    void previewExitCalculatesCorrectDurationAndFee() {

        VehicleRepository vehicleRepository = mock(VehicleRepository.class);
        ParkingHistoryRepository historyRepository = mock(ParkingHistoryRepository.class);

        ExitController controller = new ExitController(
                vehicleRepository, historyRepository
        );

        Vehicle vehicle = createTestVehicle();

        when(vehicleRepository.findByVehicleNumber("KA01AB1234"))
                .thenReturn(Optional.of(vehicle));

        ResponseEntity<?> response = controller.previewExit(Map.of(
                "vehicleNumber", "KA01AB1234",
                "exitTime", "11:15"
        ));

        assertEquals(HttpStatus.OK, response.getStatusCode());

        Map<?, ?> body = (Map<?, ?>) response.getBody();

        assertEquals(3, body.get("duration"));
        assertEquals(BigDecimal.valueOf(60), body.get("fee"));

        verify(vehicleRepository, never()).delete(any(Vehicle.class));
        verify(historyRepository, never()).save(any(ParkingHistory.class));
    }

    @Test
    void confirmExitRecordsPaymentAndRemovesVehicle() {

        VehicleRepository vehicleRepository = mock(VehicleRepository.class);
        ParkingHistoryRepository historyRepository = mock(ParkingHistoryRepository.class);

        ExitController controller = new ExitController(
                vehicleRepository, historyRepository
        );

        Vehicle vehicle = createTestVehicle();

        when(vehicleRepository.findByVehicleNumber("KA01AB1234"))
                .thenReturn(Optional.of(vehicle));

        when(historyRepository.save(any(ParkingHistory.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        ResponseEntity<?> response = controller.confirmExit(Map.of(
                "vehicleNumber", "KA01AB1234",
                "exitTime", "11:15",
                "paymentMethod", "CASH"
        ));

        assertEquals(HttpStatus.OK, response.getStatusCode());

        Map<?, ?> body = (Map<?, ?>) response.getBody();

        assertEquals(3, body.get("duration"));
        assertEquals(BigDecimal.valueOf(60), body.get("fee"));
        assertEquals("CASH", body.get("paymentMethod"));
        assertEquals("Paid", body.get("paymentStatus"));

        ParkingHistory savedHistory =
                (ParkingHistory) body.get("vehicle");

        assertNotNull(savedHistory);
        assertEquals("Paid", savedHistory.getPaymentStatus());
        assertEquals("CASH", savedHistory.getPaymentMethod());

        verify(historyRepository).save(any(ParkingHistory.class));
        verify(vehicleRepository).delete(vehicle);
    }

    private Vehicle createTestVehicle() {

        Vehicle vehicle = new Vehicle();

        vehicle.setVehicleNumber("KA01AB1234");
        vehicle.setOwnerName("Alice");
        vehicle.setVehicleType("Car");
        vehicle.setSlotNumber("P01");
        vehicle.setEntryTime("09:00");
        vehicle.setEntryDate(LocalDateTime.of(2026, 1, 10, 9, 0));

        return vehicle;
    }
}
