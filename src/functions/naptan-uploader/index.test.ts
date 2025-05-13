import { NewNaptanStop, NewNaptanStopArea } from "@bods-integrated-data/shared/database";
import { describe, expect, it } from "vitest";
import { parseXml } from ".";

describe("naptan-uploader", () => {
    describe("parseXml", () => {
        it("parses the XML into a list of stops", () => {
            const xml = `<NaPTAN>
  <StopPoints>
    <StopPoint CreationDateTime="2020-09-09T00:00:00" ModificationDateTime="2020-09-09T08:37:19" Modification="new" RevisionNumber="0" Status="active">
			<AtcoCode>021012006</AtcoCode>
			<NaptanCode>ahladadp</NaptanCode>
			<Descriptor>
				<CommonName xml:lang="en">Chiltern Green Road</CommonName>
				<Landmark xml:lang="en">Lower Hyde Road</Landmark>
				<Street xml:lang="en">Lower Harpenden Road</Street>
				<Indicator xml:lang="en">opp</Indicator>
			</Descriptor>
			<Place>
				<NptgLocalityRef>E0000324</NptgLocalityRef>
				<LocalityCentre>true</LocalityCentre>
				<Location>
					<Translation>
						<GridType>UKOS</GridType>
						<Easting>512074</Easting>
						<Northing>218119</Northing>
						<Longitude>-0.37429</Longitude>
						<Latitude>51.85042</Latitude>
					</Translation>
				</Location>
			</Place>
			<StopClassification>
				<StopType>BCT</StopType>
				<OnStreet>
					<Bus>
						<BusStopType>MKD</BusStopType>
						<TimingStatus>OTH</TimingStatus>
						<MarkedPoint>
							<Bearing>
								<CompassPoint>NW</CompassPoint>
							</Bearing>
						</MarkedPoint>
					</Bus>
				</OnStreet>
			</StopClassification>
			<StopAreas>
				<StopAreaRef Modification="new" Status="active" CreationDateTime="2025-04-09T14:52:50.7062286+01:00" ModificationDateTime="2025-04-09T14:52:50.7062286+01:00">021G12001</StopAreaRef>
			</StopAreas>
			<AdministrativeAreaRef>151</AdministrativeAreaRef>
		</StopPoint>
		<StopPoint CreationDateTime="2020-09-09T00:00:00" ModificationDateTime="2020-09-09T08:37:19" Modification="new" RevisionNumber="0" Status="active">
			<AtcoCode>021012001</AtcoCode>
			<NaptanCode>ahladada</NaptanCode>
			<Descriptor>
				<CommonName xml:lang="en">Chiltern Green Road</CommonName>
				<Landmark xml:lang="en">Chiltern Green Road</Landmark>
				<Street xml:lang="en">Lower Harpenden Road</Street>
				<Indicator xml:lang="en">adj</Indicator>
			</Descriptor>
			<Place>
				<NptgLocalityRef>E0000324</NptgLocalityRef>
				<LocalityCentre>true</LocalityCentre>
				<Location>
          <Easting>512116</Easting>
          <Northing>218097</Northing>
          <Longitude>-0.37369</Longitude>
          <Latitude>51.85022</Latitude>
					<Translation>
						<GridType>UKOS</GridType>
					</Translation>
				</Location>
			</Place>
			<StopClassification>
				<StopType>BCT</StopType>
				<OnStreet>
					<Bus>
						<BusStopType>MKD</BusStopType>
						<TimingStatus>OTH</TimingStatus>
						<MarkedPoint>
							<Bearing>
								<CompassPoint>SE</CompassPoint>
							</Bearing>
						</MarkedPoint>
					</Bus>
				</OnStreet>
			</StopClassification>
			<StopAreas>
				<StopAreaRef Modification="new" Status="active" CreationDateTime="2025-04-09T14:52:50.7112293+01:00" ModificationDateTime="2025-04-09T14:52:50.7112293+01:00">021G12001</StopAreaRef>
			</StopAreas>
			<AdministrativeAreaRef>151</AdministrativeAreaRef>
		</StopPoint>
  </StopPoints>
  <StopAreas>
    <StopArea CreationDateTime="2015-09-11T00:00:00" ModificationDateTime="2022-09-26T16:36:37" Modification="new" RevisionNumber="46" Status="active">
			<StopAreaCode>021G28078</StopAreaCode>
			<Name xml:lang="en">North Drive</Name>
			<AdministrativeAreaRef>151</AdministrativeAreaRef>
			<StopAreaType>GPBS</StopAreaType>
			<Location>
				<Translation>
					<GridType>UKOS</GridType>
					<Easting>520673</Easting>
					<Northing>235229</Northing>
					<Longitude>-0.24352</Longitude>
					<Latitude>52.00239</Latitude>
				</Translation>
			</Location>
		</StopArea>
		<StopArea CreationDateTime="2016-12-29T00:00:00" ModificationDateTime="2022-10-13T11:38:28" Modification="new" RevisionNumber="79" Status="active">
			<StopAreaCode>021GCLOPHILL</StopAreaCode>
			<Name xml:lang="en">The Green</Name>
			<ParentStopAreaRef Modification="new" Status="active" CreationDateTime="2025-04-09T14:52:56.1513451+01:00" ModificationDateTime="2025-04-09T14:52:56.1513451+01:00">021G21002</ParentStopAreaRef>
			<AdministrativeAreaRef>151</AdministrativeAreaRef>
			<StopAreaType>GPBS</StopAreaType>
			<Location>
				<Translation>
					<GridType>UKOS</GridType>
					<Easting>508206</Easting>
					<Northing>237676</Northing>
					<Longitude>-0.42428</Longitude>
					<Latitude>52.02695</Latitude>
				</Translation>
			</Location>
		</StopArea>
	</StopAreas>
</NaPTAN>`;

            const { stopPoints, stopAreas } = parseXml(xml);
            const expectedStopPoints: NewNaptanStop[] = [
                {
                    administrative_area_code: "151",
                    atco_code: "021012006",
                    bearing: "NW",
                    bus_stop_type: "MKD",
                    cleardown_code: null,
                    common_name: "Chiltern Green Road",
                    creation_date_time: null,
                    crossing: null,
                    default_wait_time: null,
                    easting: "512074",
                    grid_type: "UKOS",
                    indicator: "opp",
                    landmark: "Lower Hyde Road",
                    latitude: "51.85042",
                    locality_centre: "true",
                    locality_name: null,
                    longitude: "-0.37429",
                    modification: null,
                    modification_date_time: null,
                    naptan_code: "ahladadp",
                    northing: "218119",
                    notes: null,
                    nptg_locality_code: "E0000324",
                    plate_code: null,
                    revision_number: null,
                    short_common_name: null,
                    status: null,
                    stop_area_code: "021G12001",
                    stop_type: "BCT",
                    street: "Lower Harpenden Road",
                    suburb: null,
                    timing_status: "OTH",
                    town: null,
                },
                {
                    administrative_area_code: "151",
                    atco_code: "021012001",
                    bearing: "SE",
                    bus_stop_type: "MKD",
                    cleardown_code: null,
                    common_name: "Chiltern Green Road",
                    creation_date_time: null,
                    crossing: null,
                    default_wait_time: null,
                    easting: "512116",
                    grid_type: "UKOS",
                    indicator: "adj",
                    landmark: "Chiltern Green Road",
                    latitude: "51.85022",
                    locality_centre: "true",
                    locality_name: null,
                    longitude: "-0.37369",
                    modification: null,
                    modification_date_time: null,
                    naptan_code: "ahladada",
                    northing: "218097",
                    notes: null,
                    nptg_locality_code: "E0000324",
                    plate_code: null,
                    revision_number: null,
                    short_common_name: null,
                    status: null,
                    stop_area_code: "021G12001",
                    stop_type: "BCT",
                    street: "Lower Harpenden Road",
                    suburb: null,
                    timing_status: "OTH",
                    town: null,
                },
            ];
            const expectedStopAreas: NewNaptanStopArea[] = [
                {
                    administrative_area_code: "151",
                    easting: "520673",
                    grid_type: "UKOS",
                    latitude: "52.00239",
                    longitude: "-0.24352",
                    name: "North Drive",
                    northing: "235229",
                    stop_area_code: "021G28078",
                    stop_area_type: "GPBS",
                },
                {
                    administrative_area_code: "151",
                    easting: "508206",
                    grid_type: "UKOS",
                    latitude: "52.02695",
                    longitude: "-0.42428",
                    name: "The Green",
                    northing: "237676",
                    stop_area_code: "021GCLOPHILL",
                    stop_area_type: "GPBS",
                },
            ];

            expect(stopPoints).toEqual(expectedStopPoints);
            expect(stopAreas).toEqual(expectedStopAreas);
        });

        it("only sets the stop_area_code property when there is exactly one stop area ref", () => {
            const xml = `<NaPTAN>
<StopPoints>
  <StopPoint CreationDateTime="2020-09-09T00:00:00" ModificationDateTime="2020-09-09T08:37:19" Modification="new" RevisionNumber="0" Status="active">
    <AtcoCode>021012006</AtcoCode>
    <NaptanCode>ahladadp</NaptanCode>
    <Descriptor>
      <CommonName xml:lang="en">Chiltern Green Road</CommonName>
      <Landmark xml:lang="en">Lower Hyde Road</Landmark>
      <Street xml:lang="en">Lower Harpenden Road</Street>
      <Indicator xml:lang="en">opp</Indicator>
    </Descriptor>
    <Place>
      <NptgLocalityRef>E0000324</NptgLocalityRef>
      <LocalityCentre>true</LocalityCentre>
      <Location>
        <Translation>
          <GridType>UKOS</GridType>
          <Easting>512074</Easting>
          <Northing>218119</Northing>
          <Longitude>-0.37429</Longitude>
          <Latitude>51.85042</Latitude>
        </Translation>
      </Location>
    </Place>
    <StopClassification>
      <StopType>BCT</StopType>
      <OnStreet>
        <Bus>
          <BusStopType>MKD</BusStopType>
          <TimingStatus>OTH</TimingStatus>
          <MarkedPoint>
            <Bearing>
              <CompassPoint>NW</CompassPoint>
            </Bearing>
          </MarkedPoint>
        </Bus>
      </OnStreet>
    </StopClassification>
    <StopAreas>
      <StopAreaRef Modification="new" Status="active" CreationDateTime="2025-04-09T14:52:50.7062286+01:00" ModificationDateTime="2025-04-09T14:52:50.7062286+01:00">021G12001</StopAreaRef>
      <StopAreaRef Modification="new" Status="active" CreationDateTime="2025-04-09T14:52:50.7062286+01:00" ModificationDateTime="2025-04-09T14:52:50.7062286+01:00">021G12002</StopAreaRef>
    </StopAreas>
    <AdministrativeAreaRef>151</AdministrativeAreaRef>
  </StopPoint>
</StopPoints>
</NaPTAN>`;

            const { stopPoints } = parseXml(xml);
            const expectedStopPoints: NewNaptanStop[] = [
                {
                    administrative_area_code: "151",
                    atco_code: "021012006",
                    bearing: "NW",
                    bus_stop_type: "MKD",
                    cleardown_code: null,
                    common_name: "Chiltern Green Road",
                    creation_date_time: null,
                    crossing: null,
                    default_wait_time: null,
                    easting: "512074",
                    grid_type: "UKOS",
                    indicator: "opp",
                    landmark: "Lower Hyde Road",
                    latitude: "51.85042",
                    locality_centre: "true",
                    locality_name: null,
                    longitude: "-0.37429",
                    modification: null,
                    modification_date_time: null,
                    naptan_code: "ahladadp",
                    northing: "218119",
                    notes: null,
                    nptg_locality_code: "E0000324",
                    plate_code: null,
                    revision_number: null,
                    short_common_name: null,
                    status: null,
                    stop_area_code: null,
                    stop_type: "BCT",
                    street: "Lower Harpenden Road",
                    suburb: null,
                    timing_status: "OTH",
                    town: null,
                },
            ];

            expect(stopPoints).toEqual(expectedStopPoints);
        });
    });
});
