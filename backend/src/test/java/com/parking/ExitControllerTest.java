package com.parking;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ExitControllerTest {

    @Test
    void exitVehicleUsesProvidedExitTimeForDurationAndFee() {
        VehicleRepository vehicleRepository = mock(VehicleRepository.class);
        ParkingHistoryRepository historyRepository = mock(ParkingHistoryRepository.class);
        ExitController controller = new ExitController(vehicleRepository, historyRepository);

        Vehicle vehicle = new Vehicle();
        vehicle.setVehicleNumber("KA01AB1234");
        vehicle.setOwnerName("Alice");
        vehicle.setVehicleType("Car");
        vehicle.setSlotNumber("P01");
        vehicle.setEntryTime("09:00");
        vehicle.setEntryDate(LocalDateTime.of(2026, 1, 10, 9, 0));

        when(vehicleRepository.findByVehicleNumber("KA01AB1234")).thenReturn(java.util.Optional.of(vehicle));
        when(historyRepository.save(any(ParkingHistory.class))).thenAnswer(invocation -> invocation.getArgument(0));

        ResponseEntity<?> response = controller.exitVehicle(Map.of(
                "vehicleNumber", "ka01ab1234",
                "exitTime", "11:15"
        ));

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(3, ((Map<?, ?>) response.getBody()).get("duration"));
        assertEquals(BigDecimal.valueOf(60), ((Map<?, ?>) response.getBody()).get("fee"));
        assertNotNull(((Map<?, ?>) response.getBody()).get("vehicle"));
    }
}
